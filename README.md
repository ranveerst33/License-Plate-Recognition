# 🚗 License Plate Detection using OpenCV & FastAPI
### 🧠 A Traditional Computer Vision Project — No AI, No ML, Just Logic.

---

## 🧩 Overview
A full-stack web app that detects and highlights **license plates from vehicle images** using **classical image processing techniques** built purely on logic without any AI or ML models.  
Developed using **FastAPI** for the backend and **OpenCV + NumPy** for computer vision, the system visualizes each step of the pipeline, provides performance analytics, and generates a detailed PDF report.

---

## ⚙️ Tech Stack
- **Backend:** FastAPI (Python)  
- **Computer Vision:** OpenCV, NumPy  
- **Frontend:** HTML, CSS, JavaScript  
- **Visualization:** Chart.js  
- **PDF Reports:** html2pdf.js  

---

## 🚀 Features
- 🧠 Single & Multi-Plate Detection Modes  
- 🖼️ Step-by-Step Image Processing Visualization  
- 📊 Real-Time Analytics (Step Time & Contour Distribution Graphs)  
- 📄 Auto-Generated PDF Report  
- 🌑 Professional Dark-Themed UI  

---

## 🧠 How It Works
1. The user uploads a vehicle image via the web interface.  
2. The **FastAPI backend** processes the image through multiple OpenCV stages:
   - Grayscale Conversion → Gaussian Blur → Edge Detection → Morphology → Contour Detection  
3. Contours are filtered using **aspect ratio and area thresholds** to find plate-like rectangles.  
4. The frontend displays each step visually and highlights detected plate regions.  
5. A dashboard summarizes processing time, plate area, and contour data.  
6. The user can view analytics or export the results as a **PDF report**.

---

## 🧮 Detection Logic (Simplified)
```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blur = cv2.GaussianBlur(gray, (5,5), 0)
edges = cv2.Canny(blur, 50, 200)
morph = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
for c in contours:
    x, y, w, h = cv2.boundingRect(c)
    ar = w / float(h)
    if 2.0 <= ar <= 6.5:
        # Potential license plate region
````

---

## 🧾 Run the App

```bash
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Then open 👉 [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 🏁 Summary

This project demonstrates that **traditional computer vision techniques** are powerful enough to detect license plates without AI or deep learning combining efficiency, interpretability, and simplicity.

---

### ✨ Author

```

✒️ Ranveer Singh Thakur
📧 ranveerst33@gmail.com
🛠️ Developed in 2025 using Python, OpenCV, and FastAPI.

```
