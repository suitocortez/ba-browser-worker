import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  const { refnr } = req.body;
  if (!refnr) return res.status(400).json({ error: "refnr fehlt" });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    await page.goto(
      `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`,
      { timeout: 30000 }
    );

    await page.waitForLoadState("networkidle", { timeout: 30000 });

    const html = await page.content();
    console.log("HTML-Länge:", html.length);

    const email = await page.evaluate(() => {
      const mailto = document.querySelector("a[href^='mailto:']");
      if (mailto) return mailto.textContent;

      const text = document.body.innerText;
      const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return match ? match[0] : null;
    });

    if (!email) {
      throw new Error("Keine E-Mail gefunden");
    }

    await browser.close();
    res.json({ refnr, email });

  } catch (err) {
    console.error("❌ Extraktion Fehler:", err.message);

    try {
      await page.screenshot({ path: "error.png" });
      console.log("📸 Screenshot gespeichert");
    } catch {}

    await browser.close();
    res.status(500).json({
      error: "Extraktion fehlgeschlagen",
      message: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Browser Worker läuft auf Port ${PORT}`);
});
