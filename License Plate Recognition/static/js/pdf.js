async function generatePDF() {
  const resultContainer = document.getElementById("resultContainer");
  const analyticsSection = document.getElementById("analyticsSection");

  // Wait for all processing images
  const imgs = Array.from(document.querySelectorAll("#reportContent img"));
  await Promise.all(
    imgs.map(
      (im) =>
        im.complete
          ? Promise.resolve()
          : new Promise((res) => {
              im.onload = im.onerror = res;
            })
    )
  );

  // ✅ Convert canvases (graphs) to base64 images
  const canvases = Array.from(document.querySelectorAll("#analyticsSection canvas"));
  const convertedGraphs = canvases.map((canvas) => {
    const img = new Image();
    img.src = canvas.toDataURL("image/png", 1.0);
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.border = "1px solid #ccc";
    img.style.borderRadius = "8px";
    img.style.marginTop = "8px";
    return { canvas, img };
  });

  // ✅ Clone the content for PDF
  const wrapper = document.createElement("div");

  // Clone the result content (all steps + dashboard)
  const reportClone = document.getElementById("reportContent").cloneNode(true);

  // Clone analytics section
  const analyticsClone = document.getElementById("analyticsSection").cloneNode(true);

  // Replace canvases in the clone with the images
  const cloneCanvases = Array.from(analyticsClone.querySelectorAll("canvas"));
  cloneCanvases.forEach((c, i) => {
    const img = convertedGraphs[i]?.img;
    if (img) c.replaceWith(img);
  });

  // Build final wrapper
  wrapper.appendChild(reportClone);
  const hr = document.createElement("hr");
  hr.style.margin = "20px 0";
  wrapper.appendChild(hr);
  wrapper.appendChild(analyticsClone);

  wrapper.style.padding = "20px";
  wrapper.style.color = "#111";
  wrapper.style.fontFamily = "Arial, sans-serif";

  // ✅ Configure PDF options
  const opt = {
    margin: 0.5,
    filename: `LPR_Report_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 3,
      useCORS: true,
      scrollY: 0,
      logging: false,
    },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
  };

  // ✅ Wait for rendering to settle before generating
  await new Promise((r) => setTimeout(r, 500));

  // Generate the PDF
  html2pdf().set(opt).from(wrapper).save();
}
