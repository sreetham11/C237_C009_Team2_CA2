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
  password: 'c237009@2026!',
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

  req.flash(
    'error',
    'Please log in to view this resource'
  );

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

const checkBuyer = (req, res, next) => {
  if (
    req.session.user &&
    (
      req.session.user.role === 'buyer' ||
      req.session.user.role === 'user'
    )
  ) {
    return next();
  }

  req.flash(
    'error',
    'Only buyers can use the cart.'
  );

  res.redirect('/products');
};

// Add seller usernames to the products.
// Uses SELECT, arrays, loops and if statements.
const addSellerNames = (products, callback) => {
  const sql = `
    SELECT user_id, username
    FROM users
  `;

  db.query(sql, (error, users) => {
    if (error) {
      return callback(error);
    }

    for (let i = 0; i < products.length; i++) {
      products[i].seller_name = 'Unknown Seller';

      for (let j = 0; j < users.length; j++) {
        if (
          products[i].seller_id ==
          users[j].user_id
        ) {
          products[i].seller_name =
            users[j].username;
        }
      }
    }

    callback(null, products);
  });
};

// Get all products belonging to one seller.
// Reused by GET /products (Manage Listings) and the Seller Dashboard stats.
const getSellerProducts = (sellerId, callback) => {
  const sql = `
    SELECT *
    FROM products
    WHERE seller_id = ?
  `;

  db.query(sql, [sellerId], callback);
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
    req.flash(
      'error',
      'All fields are required.'
    );

    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  if (
    role === 'admin' &&
    adminKey !== 'C237_AdminKey'
  ) {
    req.flash(
      'error',
      'Invalid Admin Key.'
    );

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
      console.error(
        'Registration error:',
        err
      );

      req.flash(
        'error',
        'Registration failed. Please try again.'
      );

      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    req.flash(
      'success',
      'Registration successful! Please log in.'
    );

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
    req.flash(
      'error',
      'All fields are required.'
    );

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
        console.error(
          'Login error:',
          err
        );

        req.flash(
          'error',
          'Login failed. Please try again.'
        );

        return res.redirect('/login');
      }

      if (results.length > 0) {
        req.session.user = results[0];
        res.redirect('/dashboard');
      } else {
        req.flash(
          'error',
          'Invalid email or password.'
        );

        res.redirect('/login');
      }
    }
  );
});

// Display dashboard based on role
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
          console.error(
            'Error retrieving users:',
            err
          );

          req.flash(
            'error',
            'Could not load registered users.'
          );

          return res.render(
            'admindashboard',
            {
              user: user,
              messages: req.flash('success'),
              errors: req.flash('error'),
              recentUsers: []
            }
          );
        }

        res.render('admindashboard', {
          user: user,
          messages: req.flash('success'),
          errors: req.flash('error'),
          recentUsers: results
        });
      });
    } else if (user.role === 'seller') {
      getSellerProducts(user.user_id, (err, results) => {
        if (err) {
          console.error(
            'Seller stats query error:',
            err
          );

          return res.render('sellerdashboard', {
            user: user,
            messages: req.flash('success'),
            errors: req.flash('error'),
            listingCount: 0,
            totalQuantity: 0,
            totalValue: 0
          });
        }

        let totalQuantity = 0;
        let totalValue = 0;

        for (let i = 0; i < results.length; i++) {
          totalQuantity =
            totalQuantity +
            Number(results[i].quantity);

          totalValue =
            totalValue +
            (Number(results[i].price) *
              Number(results[i].quantity));
        }

        res.render('sellerdashboard', {
          user: user,
          messages: req.flash('success'),
          errors: req.flash('error'),
          listingCount: results.length,
          totalQuantity: totalQuantity,
          totalValue: totalValue
        });
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

// Upload/replace the logged-in user's profile picture
app.post(
  '/profile/picture',
  checkAuthenticated,
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      req.flash(
        'error',
        'Please choose an image to upload.'
      );

      return res.redirect('/dashboard');
    }

    const userId = req.session.user.user_id;
    const image = req.file.filename;

    const sql = `
      UPDATE users
      SET profile_picture = ?
      WHERE user_id = ?
    `;

    db.query(
      sql,
      [image, userId],
      (err) => {
        if (err) {
          console.error(
            'Profile picture update error:',
            err
          );

          req.flash(
            'error',
            'Could not update profile picture.'
          );

          return res.redirect('/dashboard');
        }

        req.session.user.profile_picture = image;

        req.flash(
          'success',
          'Profile picture updated!'
        );

        res.redirect('/dashboard');
      }
    );
  }
);

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// PERSON B — ADDING NEW PRODUCT INFORMATION

// Display add-product form
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
      category_other,
      condition_type,
      quantity,
      price,
      delivery_method,
      meetup_location
    } = req.body;

    if (
      !name ||
      !category ||
      !condition_type ||
      !quantity ||
      !price ||
      !delivery_method
    ) {
      req.flash(
        'error',
        'Please complete all required product fields.'
      );

      return res.redirect('/products/new');
    }

    let finalCategory = category;

    if (
      category === 'Others' &&
      category_other
    ) {
      finalCategory = category_other;
    }

    let image = null;

    if (req.file) {
      image = req.file.filename;
    }

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
      image
    ];

    db.query(sql, values, (err) => {
      if (err) {
        console.error(
          'Add product error:',
          err
        );

        req.flash(
          'error',
          'Could not add product.'
        );

        return res.redirect('/products/new');
      }

      req.flash(
        'success',
        'Product added successfully!'
      );

      res.redirect('/products');
    });
  }
);

// PERSON C — VIEWING AND DISPLAYING PRODUCT INFORMATION

// Display all products
app.get(
  '/products',
  (req, res) => {
    const myListings = req.query.myListings === 'true';

    const handleProductResults = (err, results) => {
      if (err) {
        console.error(
          'Products query error:',
          err
        );

        req.flash(
          'error',
          'Could not load products.'
        );

        return res.redirect('/dashboard');
      }

      addSellerNames(
        results,
        (sellerError, productsWithSellers) => {
          if (sellerError) {
            console.error(
              'Seller query error:',
              sellerError
            );

            return res.send(
              'Error retrieving seller names'
            );
          }

          res.render('products', {
            products: productsWithSellers,
            user: req.session.user,
            searchName: '',
            searchCategory: '',
            messages: req.flash('success'),
            errors: req.flash('error')
          });
        }
      );
    };

    if (myListings && req.session.user) {
      getSellerProducts(
        req.session.user.user_id,
        handleProductResults
      );
    } else {
      const sql = `
        SELECT *
        FROM products
      `;

      db.query(sql, handleProductResults);
    }
  }
);

// Display one product
app.get(
  '/product/:id',
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
          console.error(
            'View product error:',
            err
          );

          return res.send(
            'Error retrieving product'
          );
        }

        if (results.length === 0) {
          return res.send(
            'Product not found'
          );
        }

        addSellerNames(
          results,
          (sellerError, productsWithSellers) => {
            if (sellerError) {
              console.error(
                'Seller query error:',
                sellerError
              );

              return res.send(
                'Error retrieving seller name'
              );
            }

            res.render('product', {
              product: productsWithSellers[0],
              user: req.session.user,
              messages: req.flash('success'),
              errors: req.flash('error')
            });
          }
        );
      }
    );
  }
);

// PERSON D — EDITING EXISTING PRODUCT INFORMATION

// Only the seller who owns the product can open the edit form
app.get(
  '/editProduct/:id',
  checkAuthenticated,
  checkRole('seller'),
  (req, res) => {
    const productId = req.params.id;
    const user = req.session.user;

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
          console.error(
            'Database query error:',
            error.message
          );

          return res.send(
            'Error retrieving product by ID'
          );
        }

        if (results.length === 0) {
          return res.send(
            'Product not found'
          );
        }

        const product = results[0];

        if (
          product.seller_id !=
          user.user_id
        ) {
          req.flash(
            'error',
            'You can only edit your own products.'
          );

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

// Only the seller who owns the product can update it
app.post(
  '/editProduct/:id',
  checkAuthenticated,
  checkRole('seller'),
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
          console.error(
            'Error checking product:',
            checkError
          );

          req.flash(
            'error',
            'Could not check the product.'
          );

          return res.redirect('/products');
        }

        if (checkResults.length === 0) {
          req.flash(
            'error',
            'Product not found.'
          );

          return res.redirect('/products');
        }

        const product = checkResults[0];

        if (
          product.seller_id !=
          user.user_id
        ) {
          req.flash(
            'error',
            'You can only edit your own products.'
          );

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

        if (
          req.body.removeImage === 'yes'
        ) {
          image = null;
        } else if (req.file) {
          image = req.file.filename;
        }

        const updateSql = `
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
          updateSql,
          values,
          (updateError) => {
            if (updateError) {
              console.error(
                'Error updating product:',
                updateError
              );

              req.flash(
                'error',
                'Could not update the product.'
              );

              return res.redirect('/products');
            }

            req.flash(
              'success',
              'Product updated successfully!'
            );

            res.redirect('/products');
          }
        );
      }
    );
  }
);

// PERSON E — REMOVING PRODUCT INFORMATION

// Only admins can delete products
app.get(
  '/deleteProduct/:id',
  checkAuthenticated,
  checkRole('admin'),
  (req, res) => {
    const productId = req.params.id;

    const sql = `
      DELETE FROM products
      WHERE product_id = ?
    `;

    db.query(
      sql,
      [productId],
      (error) => {
        if (error) {
          console.error(
            'Error deleting product:',
            error
          );

          req.flash(
            'error',
            'Could not delete the product.'
          );

          return res.redirect('/products');
        }

        req.flash(
          'success',
          'Product deleted successfully!'
        );

        res.redirect('/products');
      }
    );
  }
);

// PERSON F — SEARCHING AND FILTERING PRODUCT INFORMATION

// The search form is displayed inside products.ejs
app.get(
  '/searchProducts',
  (req, res) => {
    res.redirect('/products');
  }
);

// Exact product-name search and category filter
app.post(
  '/searchProducts',
  (req, res) => {
    const searchName = req.body.searchName;
    const searchCategory = req.body.searchCategory;

    let sql = `
      SELECT *
      FROM products
    `;

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
          console.error(
            'Error searching products:',
            error
          );

          return res.send(
            'Error searching products'
          );
        }

        addSellerNames(
          results,
          (sellerError, productsWithSellers) => {
            if (sellerError) {
              console.error(
                'Seller query error:',
                sellerError
              );

              return res.send(
                'Error retrieving seller names'
              );
            }

            res.render('products', {
              products: productsWithSellers,
              searchName: searchName,
              searchCategory: searchCategory,
              user: req.session.user,
              messages: req.flash('success'),
              errors: req.flash('error')
            });
          }
        );
      }
    );
  }
);

// BUYER CART

// Add a product to the buyer's session cart
app.post(
  '/cart/add/:id',
  checkAuthenticated,
  checkBuyer,
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
          console.error(
            'Cart product error:',
            error
          );

          req.flash(
            'error',
            'Could not add product to cart.'
          );

          return res.redirect('/products');
        }

        if (results.length === 0) {
          req.flash(
            'error',
            'Product not found.'
          );

          return res.redirect('/products');
        }

        addSellerNames(
          results,
          (sellerError, productsWithSellers) => {
            if (sellerError) {
              console.error(
                'Seller query error:',
                sellerError
              );

              req.flash(
                'error',
                'Could not add product to cart.'
              );

              return res.redirect('/products');
            }

            if (!req.session.cart) {
              req.session.cart = [];
            }

            req.session.cart.push(
              productsWithSellers[0]
            );

            req.flash(
              'success',
              'Product added to cart!'
            );

            res.redirect('/products');
          }
        );
      }
    );
  }
);

// Display buyer cart
app.get(
  '/cart',
  checkAuthenticated,
  checkBuyer,
  (req, res) => {
    let cart = [];

    if (req.session.cart) {
      cart = req.session.cart;
    }

    let total = 0;

    for (let i = 0; i < cart.length; i++) {
      total =
        total +
        Number(cart[i].price);
    }

    res.render('cart', {
      cart: cart,
      total: total,
      user: req.session.user,
      messages: req.flash('success'),
      errors: req.flash('error')
    });
  }
);

// SERVER

app.listen(3000, () => {
  console.log(
    'ResellVault running on port http://localhost:3000/'
  );
});