use imara_diff::{Algorithm, BasicLineDiffPrinter, Diff, InternedInput, UnifiedDiffConfig};
use std::alloc::{alloc, dealloc, Layout};
use std::ptr;
use std::slice;

#[no_mangle]
pub extern "C" fn wasm_alloc(len: usize) -> *mut u8 {
    let layout = Layout::from_size_align(len.max(1), 1).unwrap();
    unsafe { alloc(layout) }
}

#[no_mangle]
pub unsafe extern "C" fn wasm_dealloc(ptr: *mut u8, len: usize) {
    if ptr.is_null() {
        return;
    }
    let layout = Layout::from_size_align(len.max(1), 1).unwrap();
    unsafe { dealloc(ptr, layout) }
}

#[no_mangle]
pub unsafe extern "C" fn wasm_diff(
    old_ptr: *const u8,
    old_len: usize,
    new_ptr: *const u8,
    new_len: usize,
    out_len_ptr: *mut usize,
) -> *const u8 {
    let old_bytes = if old_ptr.is_null() || old_len == 0 {
        &[]
    } else {
        unsafe { slice::from_raw_parts(old_ptr, old_len) }
    };
    let new_bytes = if new_ptr.is_null() || new_len == 0 {
        &[]
    } else {
        unsafe { slice::from_raw_parts(new_ptr, new_len) }
    };
    let old_text = String::from_utf8_lossy(old_bytes);
    let new_text = String::from_utf8_lossy(new_bytes);
    let input = InternedInput::new(old_text.as_ref(), new_text.as_ref());
    let mut diff = Diff::compute(Algorithm::Histogram, &input);
    diff.postprocess_lines(&input);
    let config = UnifiedDiffConfig::default();
    let printer = BasicLineDiffPrinter(&input.interner);
    let body: String = diff.unified_diff(&printer, config, &input).to_string();
    let out = body.into_bytes();
    let len = out.len();
    let ptr = wasm_alloc(len);
    if !ptr.is_null() {
        unsafe { ptr::copy_nonoverlapping(out.as_ptr(), ptr, len) };
    }
    if !out_len_ptr.is_null() {
        unsafe { *out_len_ptr = len };
    }
    ptr
}
