const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Tool endpoint: getLead
app.post("/tools/getLead", (req, res) => {
  const { phone } = req.body || {};
  console.log("getLead called with phone:", phone);

  // Return dummy lead data for now
  const lead = {
    id: "lead_dummy_123",
    first_name: "John",
    last_name: "Doe",
    phone: phone || "+15555550123",
    state: "FL",
    source: "Test",
    product_interest: "under_65_health",
    tags: ["test"]
  };

  res.json({ lead });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
