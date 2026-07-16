const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');

const app = express();

// ---- Database connection ----
// Shared team Azure MySQL database
const connection = mysql.createConnection({
  host: 'C237-marlina-mysql.mysql.database.azure.com',
  user: 'c237_009',
  password: 'c237009@2026!',
  database: 'c237_009_team2_userdb',
  ssl: {
    rejectUnauthorized: false
  }
});

connection.connect((error) => {
  if (error) {
    console.error('Error connecting to database:', error);
  } else {
    console.log('Connected to resellvault database');
  }
});

// ---- Multer setup for image uploads ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// ---- App setup ----
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Placeholder for testing ownership logic before login/sessions are covered in class
const currentUserId = 1;

// ---- Example route: View all products ----
app.get('/', (req, res) => {
  const sql = 'SELECT * FROM products';
  connection.query(sql, (error, results) => {
    if (error) {
      console.error(error);
      res.send('Error retrieving products');
    } else {
      res.render('index', { products: results });
    }
  });
});

// ---- TODO: Person B — Add Product routes (GET/POST /addProduct) ----

// ---- TODO Person C — View single product route (GET /product/:id) ----

// ---- TODO: You — Edit Product routes (GET/POST /editProduct/:id) ----
app.get('/editProduct/:id', (req, res) => {
  const productId = req.params.id;
  const sql = 'SELECT * FROM products WHERE product_id = ?';
  connection.query(sql, [productId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.send('Error retrieving product by ID');
    }
    if (results.length > 0) {
      res.render('editProduct', { product: results[0] });
    } else {
      res.send('Product not found');
    }
  });
});

app.post('/editProduct/:id', upload.single('image'), (req, res) => {
  const productId = req.params.id;
  const { name, description, category, category_other, condition_type, quantity, price, delivery_method, meetup_location } = req.body;

  let finalCategory = category;
  if (category === 'Others' && category_other && category_other.trim() !== '') {
    finalCategory = category_other.trim();
  }

  let image = req.body.currentImage;
  if (req.file) {
    image = req.file.filename;
  }

  const sql = `UPDATE products SET 
    name = ?, description = ?, category = ?, condition_type = ?, 
    quantity = ?, price = ?, delivery_method = ?, meetup_location = ?, image = ?
    WHERE product_id = ?`;

  connection.query(sql, [name, description, finalCategory, condition_type, quantity, price, delivery_method, meetup_location, image, productId], (error, results) => {
    if (error) {
      console.error('Error updating product:', error);
      res.send('Error updating product');
    } else {
      res.redirect('/');
    }
  });
});

// ---- TODO: Person E — Delete Product route (GET /deleteProduct/:id) ----

// ---- TODO: Person F — Search/filter routes ----
// Display the search and filter page
app.get('/searchProducts', (req, res) => {
  const sql = 'SELECT * FROM products';

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Error retrieving products:', error);
      return res.send('Error retrieving products');
    }

    res.render('searchProducts', {
      products: results,
      searchName: '',
      searchCategory: ''
    });
  });
});


// Process the search and filter form
app.post('/searchProducts', (req, res) => {
  const { searchName, searchCategory } = req.body;

  let sql = 'SELECT * FROM products';
  let values = [];

  // Search using both product name and category
  if (searchName && searchCategory) {
    sql = 'SELECT * FROM products WHERE name = ? AND category = ?';
    values = [searchName, searchCategory];

  // Search using product name only
  } else if (searchName) {
    sql = 'SELECT * FROM products WHERE name = ?';
    values = [searchName];

  // Filter using category only
  } else if (searchCategory) {
    sql = 'SELECT * FROM products WHERE category = ?';
    values = [searchCategory];
  }

  connection.query(sql, values, (error, results) => {
    if (error) {
      console.error('Error searching products:', error);
      return res.send('Error searching products');
    }

    res.render('searchProducts', {
      products: results,
      searchName: searchName,
      searchCategory: searchCategory
    });
  });
});

// ---- TODO: LOGIN/SESSIONS  ---

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});