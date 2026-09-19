const express = require("express");

const router = express.Router();

router.get("/callback", (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`
      <h1>Deriv Authorization Failed</h1>
      <p>${error_description || error}</p>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <h1>Deriv Authorization</h1>
      <p>No authorization code was received.</p>
    `);
  }

  res.send(`
    <h1>Deriv Authorization Successful</h1>
    <p>Authorization code received.</p>
  `);
});

module.exports = router;