use std::ffi::CStr;
use std::os::raw::{c_char, c_void};
use std::path::Path;

#[repr(C)]
pub struct NativeIndexEntry {
    pub offset: u32,
    pub data_offset: u32,
    pub orig_len: u32,
    pub comp_len: u32,
    pub kind: u8,
    pub delta_len: u32,
}

struct IndexRecord {
    offset: u32,
    data_offset: u32,
    orig_len: u32,
    comp_len: u32,
    kind: u8,
    delta_len: u32,
}

struct NativeIndex {
    entries: Vec<IndexRecord>,
    ids: Vec<String>,
}

unsafe fn read_utf8(bytes: &[u8], offset: &mut usize, len: usize) -> String {
    let s = String::from_utf8_lossy(&bytes[*offset..*offset + len]).to_string();
    *offset += len;
    s
}

unsafe fn parse_index(bytes: &[u8]) -> Vec<(String, IndexRecord)> {
    let mut out = Vec::new();
    if bytes.len() < 12 || &bytes[..4] != b"NDX1" {
        return out;
    }
    let count = u32::from_le_bytes(bytes[8..12].try_into().unwrap()) as usize;
    let mut offset = 12;
    for _ in 0..count {
        if offset + 4 > bytes.len() { break; }
        let id_len = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
        offset += 4;
        if offset + id_len > bytes.len() { break; }
        let id = read_utf8(bytes, &mut offset, id_len);
        if offset + 17 > bytes.len() { break; }
        let rec_offset = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
        let data_offset = u32::from_le_bytes(bytes[offset + 4..offset + 8].try_into().unwrap());
        let orig_len = u32::from_le_bytes(bytes[offset + 8..offset + 12].try_into().unwrap());
        let comp_len = u32::from_le_bytes(bytes[offset + 12..offset + 16].try_into().unwrap());
        let kind = bytes[offset + 16];
        offset += 17;
        let delta_len = if kind == 1 {
            if offset + 4 > bytes.len() { break; }
            let base_len = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
            offset += 4;
            if offset + base_len + 4 > bytes.len() { break; }
            let _base = read_utf8(bytes, &mut offset, base_len);
            let dlen = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
            offset += 4;
            dlen
        } else {
            0
        };
        out.push((id, IndexRecord { offset: rec_offset, data_offset, orig_len, comp_len, kind, delta_len }));
    }
    out
}

#[no_mangle]
pub unsafe extern "C" fn native_index_load(path: *const c_char) -> *mut c_void {
    if path.is_null() { return std::ptr::null_mut(); }
    let path = match CStr::from_ptr(path).to_str() { Ok(p) => p, Err(_) => return std::ptr::null_mut() };
    let bytes = match std::fs::read(Path::new(path)) { Ok(b) => b, Err(_) => return std::ptr::null_mut() };
    let parsed = unsafe { parse_index(&bytes) };
    let mut ids = Vec::with_capacity(parsed.len());
    let mut entries = Vec::with_capacity(parsed.len());
    for (id, record) in parsed { ids.push(id); entries.push(record); }
    Box::into_raw(Box::new(NativeIndex { entries, ids })) as *mut c_void
}

#[no_mangle]
pub unsafe extern "C" fn native_index_free(handle: *mut c_void) {
    if !handle.is_null() {
        drop(Box::from_raw(handle as *mut NativeIndex));
    }
}

#[no_mangle]
pub unsafe extern "C" fn native_index_find(
    handle: *mut c_void,
    id: *const c_char,
    out: *mut NativeIndexEntry,
) -> i32 {
    if handle.is_null() || id.is_null() || out.is_null() {
        return 0;
    }
    let index = &*(handle as *const NativeIndex);
    let id = match CStr::from_ptr(id).to_str() { Ok(s) => s, Err(_) => return 0 };
    for (i, candidate) in index.ids.iter().enumerate() {
        if candidate == id {
            let record = &index.entries[i];
            std::ptr::write(out, NativeIndexEntry {
                offset: record.offset,
                data_offset: record.data_offset,
                orig_len: record.orig_len,
                comp_len: record.comp_len,
                kind: record.kind,
                delta_len: record.delta_len,
            });
            return 1;
        }
    }
    0
}
