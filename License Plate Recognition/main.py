import os, uuid, time
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

UPLOAD_DIR = "uploads"
PROCESSED_DIR = "processed"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)

TEAM = [
    "Ranveer Singh Thakur C031",
    "Arya Chawan C029",
    "Sharvil Gharkar C004",
    "Aryaman Giri C026",
]

app = FastAPI()
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/processed", StaticFiles(directory=PROCESSED_DIR), name="processed")


def save_image(img, fname):
    path = os.path.join(PROCESSED_DIR, fname)
    cv2.imwrite(path, img)
    return f"/processed/{fname}"


def _common_steps(image, uid):
    steps, step_times = [], []
    h0, w0 = image.shape[:2]

    def add_step(name, img, t0):
        steps.append((name, save_image(img, f"{uid}_{len(steps)+1}_{name.replace(' ','_')}.png")))
        step_times.append((name, round((time.perf_counter() - t0) * 1000, 2)))

    t = time.perf_counter()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    add_step("Grayscale", gray, t)

    t = time.perf_counter()
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    add_step("Gaussian Blur", blur, t)

    t = time.perf_counter()
    edges = cv2.Canny(blur, 50, 200)
    add_step("Edge Detection", edges, t)

    t = time.perf_counter()
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    morph = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    add_step("Morphological Closing", morph, t)

    t = time.perf_counter()
    contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    annotated = image.copy()
    cv2.drawContours(annotated, contours, -1, (60, 190, 255), 1)
    add_step("Contours Detected", annotated, t)

    return steps, step_times, contours, (w0, h0)


def _candidate_rects(contours):
    cands = []
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        x, y, w, h = cv2.boundingRect(approx)
        if w * h < 1000:
            continue
        ar = w / float(h)
        if 2.0 <= ar <= 6.5:
            cands.append((x, y, w, h, approx))
    return cands


def detect_single_plate(image, uid):
    t0 = time.perf_counter()
    steps, step_times, contours, (w0, h0) = _common_steps(image, uid)
    cands = _candidate_rects(contours)

    # If no candidates at all
    if len(cands) == 0:
        dash = {
            "image_name": f"{uid}.png",
            "resolution": f"{w0}×{h0}",
            "width": w0, "height": h0,
            "total_contours": len(contours),
            "plate_candidates": 0,
            "processing_time": round(time.perf_counter() - t0, 3),
            "plate_area_percent": 0.0,
            "step_times": step_times,
            "contour_data": {"total": len(contours), "candidates": 0, "plates": 0},
        }
        return False, steps, dash, "No plate detected."

    # ✅ Fix: If multiple candidates, select the largest by area if dominant
    if len(cands) > 1:
        areas = [w * h for (_, _, w, h, _) in cands]
        max_area = max(areas)
        dominant = [a for a in areas if a > 0.5 * max_area]
        # If too many large similar areas → true multiple plates
        if len(dominant) > 1:
            dash = {
                "image_name": f"{uid}.png",
                "resolution": f"{w0}×{h0}",
                "width": w0, "height": h0,
                "total_contours": len(contours),
                "plate_candidates": len(cands),
                "processing_time": round(time.perf_counter() - t0, 3),
                "plate_area_percent": 0.0,
                "step_times": step_times,
                "contour_data": {"total": len(contours), "candidates": len(cands), "plates": 0},
            }
            return False, steps, dash, "Multiple possible plates detected. Please use Multi-Plate mode."

        # Keep only the largest candidate
        cands = [cands[np.argmax(areas)]]

    # Proceed with selected plate
    x, y, w, h, _ = cands[0]

    t = time.perf_counter()
    crop = image[y:y + h, x:x + w]
    steps.append(("Plate Crop", save_image(crop, f"{uid}_6_crop.png")))
    step_times.append(("Plate Crop", round((time.perf_counter() - t) * 1000, 2)))

    final = image.copy()
    cv2.rectangle(final, (x, y), (x + w, y + h), (0, 180, 255), 3)
    cv2.putText(final, "Detected Plate", (x, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 180, 255), 2)
    steps.append(("Final Annotated", save_image(final, f"{uid}_7_final.png")))

    dash = {
        "image_name": f"{uid}.png",
        "resolution": f"{w0}×{h0}",
        "width": w0, "height": h0,
        "total_contours": len(contours),
        "plate_candidates": len(cands),
        "processing_time": round(time.perf_counter() - t0, 3),
        "plate_area_percent": round((w * h) / (w0 * h0) * 100, 2),
        "step_times": step_times,
        "contour_data": {"total": len(contours), "candidates": len(cands), "plates": 1},
    }
    return True, steps, dash, ""


def detect_multi_plates(image, uid):
    t0 = time.perf_counter()
    steps, step_times, contours, (w0, h0) = _common_steps(image, uid)
    cands = _candidate_rects(contours)

    final = image.copy()
    plate_crops = []
    for i, (x, y, w, h, _) in enumerate(cands, start=1):
        # Save cropped plate
        crop = image[y:y + h, x:x + w]
        crop_path = save_image(crop, f"{uid}_plate_{i}.png")
        plate_crops.append(crop_path)

        cv2.rectangle(final, (x, y), (x + w, y + h), (0, 180, 255), 3)
        cv2.putText(final, f"Plate {i}", (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 180, 255), 2)

    steps.append(("Final Annotated (All Plates)", save_image(final, f"{uid}_8_final.png")))

    avg_area = np.mean([(w * h) / (w0 * h0) * 100 for x, y, w, h, _ in cands]) if cands else 0.0

    dash = {
        "image_name": f"{uid}.png",
        "resolution": f"{w0}×{h0}",
        "width": w0, "height": h0,
        "total_contours": len(contours),
        "plate_candidates": len(cands),
        "plates_detected": len(cands),
        "processing_time": round(time.perf_counter() - t0, 3),
        "plate_area_percent": round(avg_area, 2),
        "step_times": step_times,
        "contour_data": {"total": len(contours), "candidates": len(cands), "plates": len(cands)},
    }
    return True, steps, dash, "", plate_crops


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload_single")
async def upload_single(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())[:8]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    path = os.path.join(UPLOAD_DIR, f"{uid}{ext}")
    with open(path, "wb") as f:
        f.write(await file.read())

    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    ok, steps, dash, msg = detect_single_plate(img, uid)

    return JSONResponse({
        "success": ok,
        "message": msg,
        "dashboard": dash,
        "steps": [{"name": n, "url": u} for n, u in steps],
        "team": TEAM
    })


@app.post("/upload_multi")
async def upload_multi(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())[:8]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".bmp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    path = os.path.join(UPLOAD_DIR, f"{uid}{ext}")
    with open(path, "wb") as f:
        f.write(await file.read())

    img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    ok, steps, dash, msg, crops = detect_multi_plates(img, uid)

    return JSONResponse({
        "success": ok,
        "message": msg,
        "dashboard": dash,
        "steps": [{"name": n, "url": u} for n, u in steps],
        "plates": crops,
        "team": TEAM
    })
