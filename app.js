const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');

const app = express();

// DATABASE CONNECTION

const db = mysql.createConnection({
  host: 'c237-marlina-mysql.mysql.database.azure.com',
  user: 'c237_009',
  password: 'YOUR_DATABASE_PASSWORD',
  database: 'C237_009_team2_resellvault',
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect((err) => {
  if (err) {
    throw err;
  }

  console.log('Connected to database');
});

// APP SETUP

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use(flash());

// IMAGE UPLOAD SETUP

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage
});

// PERSON A — REGISTRATION, LOGIN AND ACCESS CONTROL

const checkAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }

  req.flash('error', 'Please log in to view this resource');
  res.redirect('/login');
};

const checkRole = (role) => {
  return (req, res, next) => {
    if (
      req.session.user &&
      req.session.user.role === role
    ) {
      return next();
    }

    req.flash('error', 'Access denied');
    res.redirect('/dashboard');
  };
};

// Home page
app.get('/', (req, res) => {
  res.render('index', {
    user: req.session.user,
    messages: req.flash('success'),
    errors: req.flash('error')
  });
});

// Display registration form
app.get('/register', (req, res) => {
  res.render('register', {
    user: req.session.user,
    errors: req.flash('error'),
    formData: req.flash('formData')[0],
    messages: req.flash('success')
  });
});

// Process registration form
app.post('/register', (req, res) => {
  const {
    username,
    email,
    password,
    address,
    contact,
    role,
    adminKey
  } = req.body;

  if (
    !username ||
    !email ||
    !password ||
    !address ||
    !contact
  ) {
    req.flash('error', 'All fields are required.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (
    role === 'admin' &&
    adminKey !== 'C237_AdminKey'
  ) {
    req.flash('error', 'Invalid Admin Key.');
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  const sql = `
    INSERT INTO users (
      username,
      email,
      password,
      address,
      contact,
      role
    )
    VALUES (?, ?, SHA1(?), ?, ?, ?)
  `;

  const values = [
    username,
    email,
    password,
    address,
    contact,
    role || 'buyer'
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error('Registration error:', err);
      req.flash('error', 'Registration failed. Please try again.');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  });
});

// Display login form
app.get('/login', (req, res) => {
  res.render('login', {
    user: req.session.user,
    errors: req.flash('error'),
    messages: req.flash('success')
  });
});

// Process login form
app.post('/login', (req, res) => {
  const {
    email,
    password
  } = req.body;

  if (!email || !password) {
    req.flash('error', 'All fields are required.');
    return res.redirect('/login');
  }

  const sql = `
    SELECT *
    FROM users
    WHERE email = ?
    AND password = SHA1(?)
  `;

  db.query(
    sql,
    [email, password],
    (err, results) => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Login failed. Please try again.');
        return res.redirect('/login');
      }

      if (results.length > 0) {
        req.session.user = results[0];
        res.redirect('/dashboard');
      } else {
        req.flash('error', 'Invalid email or password.');
        res.redirect('/login');
      }
    }
  );
});

// Display the correct dashboard based on role
app.get(
  '/dashboard',
  checkAuthenticated,
  (req, res) => {
    const user = req.session.user;

    if (user.role === 'admin') {
      const sql = `
        SELECT
          user_id,
          username,
          email,
          registered_at
        FROM users
      `;

      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error retrieving users:', err);
          req.flash('error', 'Could not load registered users.');

          return res.render('admindashboard', {
            user: user,
            messages: req.flash('success'),
            errors: req.flash('error'),
            recentUsers: []
          });
        }

        res.render('admindashboard', {
          user: user,
          messages: req.flash('success'),
          errors: req.flash('error'),
          recentUsers: results
        });
      });
    } else if (user.role === 'seller') {
      res.render('sellerdashboard', {
        user: user,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    } else {
      res.render('dashboard', {
        user: user,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    }
  }
);

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// PERSON B — ADDING NEW PRODUCT INFORMATION

// Display add product form
app.get(
  '/products/new',
  checkAuthenticated,
  checkRole('seller'),
  (req, res) => {
    res.render('newProduct', {
      user: req.session.user,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  }
);

// Add product to database
app.post(
  '/products',
  checkAuthenticated,
  checkRole('seller'),
  upload.single('image'),
  (req, res) => {
    const {
      name,
      description,
      category,
      condition_type,
      quantity,
      price,
      delivery_method,
      meetup_location
    } = req.body;

    const finalCategory = category;

    const sql = `
      INSERT INTO products (
        seller_id,
        name,
        description,
        category,
        condition_type,
        quantity,
        price,
        delivery_method,
        meetup_location,
        image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      req.session.user.user_id,
      name,
      description,
      finalCategory,
      condition_type,
      quantity,
      price,
      delivery_method,
      meetup_location,
      req.file ? req.file.filename : null
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error('Add product error:', err);
        req.flash('error', 'Could not add product.');
        return res.redirect('/products/new');
      }

      req.flash('success', 'Product added successfully!');
      res.redirect('/products');
    });
  }
);

// PERSON C — VIEWING AND DISPLAYING PRODUCT INFORMATION

// Display all products
app.get(
  '/products',
  checkAuthenticated,
  (req, res) => {
    const sql = 'SELECT * FROM products';

    db.query(sql, (err, results) => {
      if (err) {
        console.error('Products query error:', err);
        req.flash('error', 'Could not load products.');
        return res.redirect('/dashboard');
      }

      res.render('products', {
        products: results,
        user: req.session.user,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  }
);

// Display one product by ID
app.get(
  '/product/:id',
  checkAuthenticated,
  (req, res) => {
    const productId = req.params.id;

    const sql = `
      SELECT *
      FROM products
      WHERE product_id = ?
    `;

    db.query(
      sql,
      [productId],
      (err, results) => {
        if (err) {
          console.error('View product error:', err);
          return res.send('Error retrieving product');
        }

        if (results.length > 0) {
          res.render('product', {
            product: results[0],
            user: req.session.user
          });
        } else {
          res.send('Product not found');
        }
      }
    );
  }
);

// PERSON D — EDITING EXISTING PRODUCT INFORMATION

// Display edit product form
app.get(
  '/editProduct/:id',
  checkAuthenticated,
  (req, res) => {
    const productId = req.params.id;

    const sql = `
      SELECT *
      FROM products
      WHERE product_id = ?
    `;

    db.query(
      sql,
      [productId],
      (error, results) => {
        if (error) {
          console.error('Database query error:', error.message);
          return res.send('Error retrieving product by ID');
        }

        if (results.length === 0) {
          return res.send('Product not found');
        }

        const product = results[0];
        const user = req.session.user;

        const isAdmin = user.role === 'admin';

        const isProductOwner =
          user.role === 'seller' &&
          product.seller_id == user.user_id;

        if (!isAdmin && !isProductOwner) {
          req.flash('error', 'You are not allowed to edit this product.');
          return res.redirect('/products');
        }

        res.render('editProduct', {
          product: product,
          user: user
        });
      }
    );
  }
);

// Update product in database
app.post(
  '/editProduct/:id',
  checkAuthenticated,
  upload.single('image'),
  (req, res) => {
    const productId = req.params.id;
    const user = req.session.user;

    const checkSql = `
      SELECT *
      FROM products
      WHERE product_id = ?
    `;

    db.query(
      checkSql,
      [productId],
      (checkError, checkResults) => {
        if (checkError) {
          console.error('Error checking product:', checkError);
          req.flash('error', 'Could not check the product.');
          return res.redirect('/products');
        }

        if (checkResults.length === 0) {
          req.flash('error', 'Product not found.');
          return res.redirect('/products');
        }

        const product = checkResults[0];

        const isAdmin = user.role === 'admin';

        const isProductOwner =
          user.role === 'seller' &&
          product.seller_id == user.user_id;

        if (!isAdmin && !isProductOwner) {
          req.flash('error', 'You are not allowed to edit this product.');
          return res.redirect('/products');
        }

        const {
          name,
          description,
          category,
          category_other,
          condition_type,
          quantity,
          price,
          delivery_method,
          meetup_location
        } = req.body;

        let finalCategory = category;

        if (
          category === 'Others' &&
          category_other
        ) {
          finalCategory = category_other;
        }

        let image = req.body.currentImage;

        if (req.file) {
          image = req.file.filename;
        }

        const sql = `
          UPDATE products
          SET
            name = ?,
            description = ?,
            category = ?,
            condition_type = ?,
            quantity = ?,
            price = ?,
            delivery_method = ?,
            meetup_location = ?,
            image = ?
          WHERE product_id = ?
        `;

        const values = [
          name,
          description,
          finalCategory,
          condition_type,
          quantity,
          price,
          delivery_method,
          meetup_location,
          image,
          productId
        ];

        db.query(
          sql,
          values,
          (error) => {
            if (error) {
              console.error('Error updating product:', error);
              req.flash('error', 'Could not update the product.');
              return res.redirect('/products');
            }

            req.flash('success', 'Product updated successfully!');
            res.redirect('/products');
          }
        );
      }
    );
  }
);

// PERSON E — REMOVING PRODUCT INFORMATION

// Delete product after checking role and ownership
app.get(
  '/deleteProduct/:id',
  checkAuthenticated,
  (req, res) => {
    const productId = req.params.id;
    const user = req.session.user;

    const checkSql = `
      SELECT *
      FROM products
      WHERE product_id = ?
    `;

    db.query(
      checkSql,
      [productId],
      (checkError, checkResults) => {
        if (checkError) {
          console.error('Error checking product before deletion:', checkError);
          req.flash('error', 'Could not check the product.');
          return res.redirect('/products');
        }

        if (checkResults.length === 0) {
          req.flash('error', 'Product not found.');
          return res.redirect('/products');
        }

        const product = checkResults[0];

        const isAdmin = user.role === 'admin';

        const isProductOwner =
          user.role === 'seller' &&
          product.seller_id == user.user_id;

        if (!isAdmin && !isProductOwner) {
          req.flash('error', 'You are not allowed to delete this product.');
          return res.redirect('/products');
        }

        const deleteSql = `
          DELETE FROM products
          WHERE product_id = ?
        `;

        db.query(
          deleteSql,
          [productId],
          (deleteError) => {
            if (deleteError) {
              console.error('Error deleting product:', deleteError);
              req.flash('error', 'Could not delete the product.');
              return res.redirect('/products');
            }

            req.flash('success', 'Product deleted successfully!');
            res.redirect('/products');
          }
        );
      }
    );
  }
);

// PERSON F — SEARCHING AND FILTERING PRODUCT INFORMATION

// Display search form and all products
app.get(
  '/searchProducts',
  checkAuthenticated,
  (req, res) => {
    const sql = 'SELECT * FROM products';

    db.query(sql, (error, results) => {
      if (error) {
        console.error('Error retrieving products:', error);
        return res.send('Error retrieving products');
      }

      res.render('searchProducts', {
        products: results,
        searchName: '',
        searchCategory: '',
        user: req.session.user
      });
    });
  }
);

// Process search and category filter
app.post(
  '/searchProducts',
  checkAuthenticated,
  (req, res) => {
    const {
      searchName,
      searchCategory
    } = req.body;

    let sql = 'SELECT * FROM products';
    let values = [];

    if (
      searchName &&
      searchCategory
    ) {
      sql = `
        SELECT *
        FROM products
        WHERE name = ?
        AND category = ?
      `;

      values = [
        searchName,
        searchCategory
      ];
    } else if (searchName) {
      sql = `
        SELECT *
        FROM products
        WHERE name = ?
      `;

      values = [
        searchName
      ];
    } else if (searchCategory) {
      sql = `
        SELECT *
        FROM products
        WHERE category = ?
      `;

      values = [
        searchCategory
      ];
    }

    db.query(
      sql,
      values,
      (error, results) => {
        if (error) {
          console.error('Error searching products:', error);
          return res.send('Error searching products');
        }

        res.render('searchProducts', {
          products: results,
          searchName: searchName,
          searchCategory: searchCategory,
          user: req.session.user
        });
      }
    );
  }
);

// SERVER

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('ResellVault running on port http://localhost:' + PORT + '/');
});