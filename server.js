const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;

// Initialize SQLite database with persistent volume path
const dbPath = process.env.NODE_ENV === 'production' ? '/app/data/loans.db' : './loans.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Create loans table
db.run(`
  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL,
    interestRate REAL,
    term INTEGER,
    extraPayment REAL,
    monthlyPayment REAL,
    totalInterest REAL,
    payoffMonths INTEGER,
    timestamp TEXT,
    schedule TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  }
});

// Set SQLite to handle moderate concurrency
db.run('PRAGMA busy_timeout = 5000;');
db.run('PRAGMA journal_mode = WAL;');

app.use(cors());
app.use(express.json());

app.post('/api/loans', (req, res) => {
  const { amount, interestRate, term, extraPayment, result } = req.body;
  const { monthlyPayment, totalInterest, payoffMonths, schedule } = result;

  const query = `
    INSERT INTO loans (amount, interestRate, term, extraPayment, monthlyPayment, totalInterest, payoffMonths, timestamp, schedule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    amount,
    interestRate,
    term,
    extraPayment,
    monthlyPayment,
    totalInterest,
    payoffMonths,
    new Date().toISOString(),
    JSON.stringify(schedule)
  ];

  db.run(query, params, function (err) {
    if (err) {
      console.error('Error saving loan:', err.message);
      return res.status(500).json({ error: 'Failed to save loan' });
    }
    res.status(201).json({
      id: this.lastID,
      amount,
      interestRate,
      term,
      extraPayment,
      result: { monthlyPayment, totalInterest, payoffMonths, schedule },
      timestamp: new Date().toISOString()
    });
  });
});

app.get('/api/loans', (req, res) => {
  const query = 'SELECT * FROM loans';
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching loans:', err.message);
      return res.status(500).json({ error: 'Failed to fetch loans' });
    }
    const loans = rows.map(row => ({
      ...row,
      result: {
        monthlyPayment: row.monthlyPayment,
        totalInterest: row.totalInterest,
        payoffMonths: row.payoffMonths,
        schedule: JSON.parse(row.schedule)
      }
    }));
    res.json(loans);
  });
});

// Close database on process exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    }
    console.log('SQLite database closed');
    process.exit(0);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});