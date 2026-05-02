use byteorder::{LittleEndian, ReadBytesExt};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, BufReader, Read};
use std::path::Path;
use thiserror::Error;

const MAGIC: &[u8; 4] = b"PK1\0";

#[derive(Debug, Error)]
pub enum LoadError {
    #[error("io: {0}")]
    Io(#[from] io::Error),
    #[error("bad magic")]
    BadMagic,
    #[error("unsupported version: {0}")]
    BadVersion(u16),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteDecision {
    pub provider: String,
    pub model: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClassMap {
    pub classes: Vec<ClassEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ClassEntry {
    pub provider: String,
    pub model: String,
}

#[derive(Debug)]
pub struct Router {
    version: u16,
    feature_count: u16,
    class_count: u16,
    bias: Vec<f32>,
    weights: Vec<f32>, // row-major [feature_count * class_count]
    classes: Vec<ClassEntry>,
}

impl Router {
    pub fn fallback() -> Self {
        Self {
            version: 0,
            feature_count: 1,
            class_count: 1,
            bias: vec![0.0],
            weights: vec![0.0],
            classes: vec![ClassEntry {
                provider: "anthropic".into(),
                model: "claude-sonnet-4-6".into(),
            }],
        }
    }

    pub fn load(bundled: &Path, app_data: &Path) -> Result<Self, LoadError> {
        // Prefer app-data copy if present (server-updated). Fall back to bundled.
        let path = if app_data.exists() { app_data } else { bundled };
        let class_map_path = path.with_extension("classes.json");

        let mut reader = BufReader::new(File::open(path)?);
        let mut magic = [0u8; 4];
        reader.read_exact(&mut magic)?;
        if &magic != MAGIC {
            return Err(LoadError::BadMagic);
        }

        let version = reader.read_u16::<LittleEndian>()?;
        if version != 1 {
            return Err(LoadError::BadVersion(version));
        }

        let feature_count = reader.read_u16::<LittleEndian>()?;
        let class_count = reader.read_u16::<LittleEndian>()?;

        let mut bias = vec![0f32; class_count as usize];
        for slot in bias.iter_mut() {
            *slot = reader.read_f32::<LittleEndian>()?;
        }

        let n = feature_count as usize * class_count as usize;
        let mut weights = vec![0f32; n];
        for slot in weights.iter_mut() {
            *slot = reader.read_f32::<LittleEndian>()?;
        }

        let classes = if class_map_path.exists() {
            let raw = std::fs::read_to_string(&class_map_path)?;
            let map: ClassMap =
                serde_json::from_str(&raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
            map.classes
        } else {
            (0..class_count)
                .map(|i| ClassEntry {
                    provider: "anthropic".into(),
                    model: format!("class-{i}"),
                })
                .collect()
        };

        Ok(Self {
            version,
            feature_count,
            class_count,
            bias,
            weights,
            classes,
        })
    }

    pub fn version_string(&self) -> String {
        format!(
            "v{} (F={}, C={})",
            self.version, self.feature_count, self.class_count
        )
    }

    pub fn route(&self, prompt: &str) -> RouteDecision {
        // Feature extraction is duplicated here for offline determinism.
        // Keep in sync with packages/router/src/features.ts.
        let features = extract_features(prompt, self.feature_count as usize);

        let c = self.class_count as usize;
        let f = self.feature_count as usize;
        let mut scores = self.bias.clone();
        for fi in 0..f {
            let x = features[fi];
            if x == 0.0 {
                continue;
            }
            let row = fi * c;
            for cj in 0..c {
                scores[cj] += x * self.weights[row + cj];
            }
        }

        let (idx, _) = softmax_argmax(&scores);
        let conf = softmax_value(&scores, idx);
        let entry = &self.classes[idx];
        RouteDecision {
            provider: entry.provider.clone(),
            model: entry.model.clone(),
            confidence: conf,
        }
    }
}

fn extract_features(prompt: &str, n: usize) -> Vec<f32> {
    let mut v = vec![0f32; n];
    if n == 0 {
        return v;
    }
    let len = prompt.chars().count() as f32;
    v[0] = (len + 1.0).log10();
    if n > 1 {
        v[1] = if prompt.contains("```") { 1.0 } else { 0.0 };
    }
    if n > 2 {
        let kw = ["refactor", "explain", "debug", "review", "plan", "edit", "write"];
        let lower = prompt.to_lowercase();
        let hits = kw.iter().filter(|k| lower.contains(*k)).count() as f32;
        v[2] = hits;
    }
    v
}

fn softmax_argmax(scores: &[f32]) -> (usize, f32) {
    let mut best = 0usize;
    let mut best_v = f32::NEG_INFINITY;
    for (i, &s) in scores.iter().enumerate() {
        if s > best_v {
            best_v = s;
            best = i;
        }
    }
    (best, best_v)
}

fn softmax_value(scores: &[f32], idx: usize) -> f32 {
    let max = scores.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let mut sum = 0f32;
    for &s in scores {
        sum += (s - max).exp();
    }
    if sum == 0.0 {
        return 1.0;
    }
    ((scores[idx] - max).exp()) / sum
}
