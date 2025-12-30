import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.post("/extract", async (req, res) => {
  const { refnr } = req.body;

  if (!refnr) {
    return res.status(400).json({ error: "refnr fehlt" });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    // 1️⃣ Seite laden
    await page.goto(
      `https://www.arbeitsagentur.de/jobsuche/jobdetail/${refnr}`,
      { timeout: 30000 }
    );

    // 2️⃣ Warten bis SPA fertig ist
    await page.waitForLoadState("networkidle", { timeout: 30000 });

    // Debug
    const html = await page.content();
    console.log("HTML-Länge:", html.length);

    // 3️⃣ Kontaktdaten extrahieren (robust, tolerant)
    const contact = await page.evaluate(() => {
      const text = document.body.innerText;

      const emailMatch = text.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
      );

      const phoneMatch = text.match(
        /(\+49|0)[0-9 ()\/-]{6,}/
      );

      const nameMatch = text.match(
        /(Ansprechpartner(?:in)?|Kontakt):?\s*([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/
      );

      return {
        name: nameMatch ? nameMatch[2] : null,
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0] : null,
        raw: text.slice(0, 2000) // nur zur Analyse / Debug
      };
    });

    if (!contact.name && !contact.email && !contact.phone) {
      throw new Error("Keine Kontaktdaten gefunden");
    }

    await browser.close();

    res.json({
      refnr,
      contact
    });

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
