//! Tiny in-memory cache with stale-while-revalidate support.

use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const FRESH_TTL: Duration = Duration::from_secs(30 * 60);
const STALE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Clone)]
struct Entry {
    value: Value,
    fresh_until: Instant,
    stale_until: Instant,
}

static CACHE: OnceLock<Mutex<HashMap<String, Entry>>> = OnceLock::new();

fn store() -> &'static Mutex<HashMap<String, Entry>> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn get_fresh(key: &str) -> Option<Value> {
    let map = store().lock().ok()?;
    match map.get(key) {
        Some(entry) if Instant::now() <= entry.fresh_until => Some(entry.value.clone()),
        _ => None,
    }
}

pub fn get_stale(key: &str) -> Option<Value> {
    let mut map = store().lock().ok()?;
    match map.get(key) {
        Some(entry) if Instant::now() <= entry.stale_until => Some(entry.value.clone()),
        Some(_) => {
            map.remove(key);
            None
        }
        None => None,
    }
}

pub fn set(key: &str, value: Value) {
    if let Ok(mut map) = store().lock() {
        let now = Instant::now();
        map.insert(
            key.to_string(),
            Entry {
                value,
                fresh_until: now + FRESH_TTL,
                stale_until: now + STALE_TTL,
            },
        );
    }
}
