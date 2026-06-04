// 浏览器端文档导出（动态加载，减小初始包体积）

export async function generateDocxBlob(title, text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const lines = text.split("\n");
  const children = [];

  children.push(
    new Paragraph({
      text: title || "导出文档",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^#\s*/, ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 },
        })
      );
    } else if (trimmed.startsWith("## ") || (trimmed.startsWith("第") && trimmed.includes("场"))) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^#+\s*/, ""),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 200 },
        })
      );
    } else if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          text: trimmed.replace(/^#+\s*/, ""),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 150 },
        })
      );
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, size: 22 })],
          spacing: { after: 120 },
        })
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
}

export async function generatePptxBlob(title, text) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const slide1 = pptx.addSlide();
  slide1.background = { fill: "1A1A2E" };
  slide1.addText(title || "创作方案", { x: 0.5, y: 1.5, w: "90%", h: 2, fontSize: 36, color: "D4AF37", bold: true, align: "center" });
  slide1.addText(new Date().toISOString().slice(0, 10), { x: 0.5, y: 3.5, w: "90%", h: 0.5, fontSize: 14, color: "888888", align: "center" });

  const sections = text.split(/\n(?=#{1,3}\s|\*\*|【|■|□|★|●)/);
  for (const sec of sections) {
    if (!sec.trim()) continue;
    const lines = sec.trim().split("\n");
    const slide = pptx.addSlide();
    slide.background = { fill: "0D0D1A" };

    let slideTitle = lines[0].replace(/^#+\s*/, "").trim();
    if (slideTitle.length > 60) slideTitle = slideTitle.slice(0, 60) + "...";
    slide.addText(slideTitle, { x: 0.5, y: 0.3, w: "90%", h: 0.7, fontSize: 22, color: "FFD700", bold: true });

    const content = lines.slice(1).join("\n").trim();
    slide.addText(content || sec.trim(), {
      x: 0.5, y: 1.2, w: "90%", h: 4.5, fontSize: 14, color: "E0E0E0",
      bullet: content.includes("\n"), valign: "top", lineSpacing: 24,
    });
  }

  return await pptx.write({ outputType: "blob" });
}
