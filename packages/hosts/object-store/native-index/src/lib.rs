use std::ffi::CStr;
use std::os::raw::{c_char, c_void};
use std::path::Path;

// Phase B's mapping, WITHOUT a dependency: the crate speaks raw FFI already
// (it is loaded through bun:ffi), and an mmap is three libc calls. A
// zero-dependency native surface is the ObjectStore study's whole premise —
// one fewer crate to audit, build and vendor for a read-only page mapping.
use std::os::unix::io::AsRawFd;

extern "C" {
    fn mmap(
        addr: *mut c_void,
        length: usize,
        prot: i32,
        flags: i32,
        fd: i32,
        offset: i64,
    ) -> *mut c_void;
    fn munmap(addr: *mut c_void, length: usize) -> i32;
}

const PROT_READ: i32 = 1;
const MAP_PRIVATE: i32 = 2;

/// A read-only private mapping of one file. `Drop` unmaps; the bytes are
/// the file's, faulted in on demand — the cold start pays a page table
/// entry, not a copy of the file.
struct Mmap {
    ptr: *mut c_void,
    len: usize,
}

impl Mmap {
    fn map(file: &std::fs::File) -> Option<Mmap> {
        let len = file.metadata().ok()?.len() as usize;
        if len == 0 {
            return None;
        }
        let ptr = unsafe {
            mmap(
                std::ptr::null_mut(),
                len,
                PROT_READ,
                MAP_PRIVATE,
                file.as_raw_fd(),
                0,
            )
        };
        if ptr == usize::MAX as *mut c_void {
            return None;
        }
        Some(Mmap { ptr, len })
    }

    fn bytes(&self) -> &[u8] {
        unsafe { std::slice::from_raw_parts(self.ptr as *const u8, self.len) }
    }
}

impl Drop for Mmap {
    fn drop(&mut self) {
        unsafe {
            munmap(self.ptr, self.len);
        }
    }
}

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
    /// The id's span INSIDE the memory map — the find compares bytes from
    /// the mapping, so no entry ever owns a copy of its id (Phase B).
    id_offset: u32,
    id_len: u32,
    offset: u32,
    data_offset: u32,
    orig_len: u32,
    comp_len: u32,
    kind: u8,
    delta_len: u32,
}

struct NativeIndex {
    /// The mapping the entries reference; it lives exactly as long as the
    /// handle (the parse's spans point into it).
    map: Mmap,
    entries: Vec<IndexRecord>,
}

unsafe fn parse_index(bytes: &[u8]) -> Vec<IndexRecord> {
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
        // The id's span, not the id: the mapping holds the bytes.
        let id_offset = offset as u32;
        let id_len_u32 = id_len as u32;
        offset += id_len;
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
            offset += base_len;
            if offset + 4 > bytes.len() { break; }
            let dlen = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
            offset += 4;
            dlen
        } else {
            0
        };
        out.push(IndexRecord {
            id_offset,
            id_len: id_len_u32,
            offset: rec_offset,
            data_offset,
            orig_len,
            comp_len,
            kind,
            delta_len,
        });
    }
    out
}

#[no_mangle]
pub unsafe extern "C" fn native_index_load(path: *const c_char) -> *mut c_void {
    if path.is_null() { return std::ptr::null_mut(); }
    let path = match CStr::from_ptr(path).to_str() { Ok(p) => p, Err(_) => return std::ptr::null_mut() };
    // Phase B: the index is MAPPED, not read — the cold start pays a page
    // table entry, not a copy of the file, and the entries the parse
    // produces reference the mapping instead of owning strings. A file
    // that cannot be mapped (an empty index, a non-regular file) falls
    // back to the honest NULL the caller already handles.
    let file = match std::fs::File::open(Path::new(path)) { Ok(f) => f, Err(_) => return std::ptr::null_mut() };
    let map = match Mmap::map(&file) { Some(m) => m, None => return std::ptr::null_mut() };
    let entries = unsafe { parse_index(map.bytes()) };
    Box::into_raw(Box::new(NativeIndex { map, entries })) as *mut c_void
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
    let id = CStr::from_ptr(id).to_bytes();
    for record in index.entries.iter() {
        let start = record.id_offset as usize;
        let end = start + record.id_len as usize;
        let bytes = index.map.bytes();
        if end > bytes.len() { continue; }
        if &bytes[start..end] == id {
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    /// A synthetic NDX1 in the writer's format: count + per entry
    /// (id_len, id, rec_offset, data_offset, orig_len, comp_len, kind,
    /// and for kind=1 the delta's base + dlen).
    fn write_index(entries: &[(&str, u32, u8)]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(b"NDX1");
        out.extend_from_slice(&[0u8; 4]); // reserved
        out.extend_from_slice(&(entries.len() as u32).to_le_bytes());
        for (id, offset, kind) in entries {
            out.extend_from_slice(&(id.len() as u32).to_le_bytes());
            out.extend_from_slice(id.as_bytes());
            out.extend_from_slice(&offset.to_le_bytes());
            out.extend_from_slice(&1024u32.to_le_bytes());
            out.extend_from_slice(&10u32.to_le_bytes());
            out.extend_from_slice(&4u32.to_le_bytes());
            out.push(*kind);
            if *kind == 1 {
                let base = "base-id";
                out.extend_from_slice(&(base.len() as u32).to_le_bytes());
                out.extend_from_slice(base.as_bytes());
                out.extend_from_slice(&99u32.to_le_bytes());
            }
        }
        out
    }

    fn load_bytes(bytes: &[u8]) -> (*mut c_void, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("ndx-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(format!("{}.idx", bytes.len()));
        std::fs::write(&path, bytes).unwrap();
        let cpath = CString::new(path.to_str().unwrap()).unwrap();
        let handle = unsafe { native_index_load(cpath.as_ptr()) };
        assert!(!handle.is_null(), "the mmap load must succeed");
        (handle, path)
    }

    #[test]
    fn mmap_load_finds_every_entry_with_its_fields() {
        let bytes = write_index(&[("alpha", 7, 0), ("beta", 21, 0), ("gamma", 99, 1)]);
        let (handle, path) = load_bytes(&bytes);
        let mut out = NativeIndexEntry {
            offset: 0,
            data_offset: 0,
            orig_len: 0,
            comp_len: 0,
            kind: 0,
            delta_len: 0,
        };
        // Present ids answer their fields (the mapping's bytes, no copy).
        let alpha = CString::new("alpha").unwrap();
        let found = unsafe { native_index_find(handle, alpha.as_ptr(), &mut out) };
        assert_eq!(found, 1);
        assert_eq!((out.offset, out.data_offset, out.orig_len, out.comp_len, out.kind), (7, 1024, 10, 4, 0));
        // The delta entry reports its delta length (the walk's arithmetic).
        let gamma = CString::new("gamma").unwrap();
        let found = unsafe { native_index_find(handle, gamma.as_ptr(), &mut out) };
        assert_eq!(found, 1);
        assert_eq!((out.offset, out.kind, out.delta_len), (99, 1, 99));
        // An absent id answers zero, not garbage.
        let missing = CString::new("delta").unwrap();
        assert_eq!(unsafe { native_index_find(handle, missing.as_ptr(), &mut out) }, 0);
        unsafe { native_index_free(handle) };
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn a_missing_or_empty_file_loads_as_null() {
        let cpath = CString::new("/nonexistent/index.idx").unwrap();
        assert!(unsafe { native_index_load(cpath.as_ptr()) }.is_null());
        // An empty file maps to nothing: the honest NULL the caller handles.
        let dir = std::env::temp_dir().join(format!("ndx-empty-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("empty.idx");
        std::fs::write(&path, b"").unwrap();
        let cpath = CString::new(path.to_str().unwrap()).unwrap();
        assert!(unsafe { native_index_load(cpath.as_ptr()) }.is_null());
        std::fs::remove_file(&path).ok();
    }
}
