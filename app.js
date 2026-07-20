const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');

// Added from C237-main
const multer = require('multer');
const path = require('path');

const app = express();

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
        console.error('Database connection failed:', err);
        process.exit(1);
    }

    console.log('Connected to database');
});

app.use(express.urlencoded({
    extended: false
}));

app.use(express.static('public'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,

    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

app.use(flash());

app.set('view engine', 'ejs');

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


app.get('/', (req, res) => {
    res.render('index', {
        user: req.session.user,
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

// ==================================================
// REGISTRATION — CA2 CODE
// ==================================================

app.get('/register', (req, res) => {
    res.render('register', {
        user: req.session.user,
        errors: req.flash('error'),
        formData: req.flash('formData')[0],
        messages: req.flash('success')
    });
});

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
        role || 'user'
    ];

    db.query(sql, values, (err) => {
        if (err) {
            console.error('Registration error:', err);

            req.flash(
                'error',
                'Registration failed. Please try again.'
            );

            return res.redirect('/register');
        }

        req.flash(
            'success',
            'Registration successful! Please log in.'
        );

        res.redirect('/login');
    });
});

// ==================================================
// LOGIN — CA2 CODE
// ==================================================

app.get('/login', (req, res) => {
    res.render('login', {
        user: req.session.user,
        errors: req.flash('error'),
        messages: req.flash('success')
    });
});

app.post('/login', (req, res) => {
    const {
        email,
        password
    } = req.body;

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

// ==================================================
// DASHBOARD — CA2 CODE
// ==================================================

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
                ORDER BY registered_at DESC
                LIMIT 10
            `;

            db.query(sql, (err, results) => {
                if (err) {
                    console.error(
                        'Error fetching recent users:',
                        err
                    );

                    req.flash(
                        'error',
                        'Could not load recent registrations.'
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
        } else {
            res.render('dashboard', {
                user: user,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        }
    }
);

// ==================================================
// INVENTORY CRUD — ORIGINAL CA2 CODE
// ==================================================

app.get(
    '/products',
    checkAuthenticated,
    (req, res) => {
        const sql = 'SELECT * FROM products';

        db.query(sql, (err, results) => {
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

            res.render('products', {
                products: results,
                user: req.session.user
            });
        });
    }
);

app.get(
    '/products/new',
    checkAuthenticated,
    checkRole('seller'),
    (req, res) => {
        res.render('newProduct');
    }
);

app.post(
    '/products',
    checkAuthenticated,
    checkRole('seller'),
    (req, res) => {
        const {
            name,
            category,
            price,
            stock
        } = req.body;

        const sql = `
            INSERT INTO products (
                name,
                category,
                price,
                stock,
                seller_id
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        const values = [
            name,
            category,
            price,
            stock,
            req.session.user.user_id
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

                return res.redirect('/products');
            }

            req.flash(
                'success',
                'Product added successfully!'
            );

            res.redirect('/products');
        });
    }
);

app.get(
    '/products/edit/:id',
    checkAuthenticated,
    checkRole('seller'),
    (req, res) => {
        const sql = `
            SELECT *
            FROM products
            WHERE id = ?
        `;

        db.query(
            sql,
            [req.params.id],
            (err, results) => {
                if (err) {
                    console.error(
                        'Edit product error:',
                        err
                    );

                    req.flash(
                        'error',
                        'Could not load product.'
                    );

                    return res.redirect('/products');
                }

                res.render('editProduct', {
                    product: results[0]
                });
            }
        );
    }
);

app.post(
    '/products/update/:id',
    checkAuthenticated,
    checkRole('seller'),
    (req, res) => {
        const {
            name,
            category,
            price,
            stock
        } = req.body;

        const sql = `
            UPDATE products
            SET
                name = ?,
                category = ?,
                price = ?,
                stock = ?
            WHERE id = ?
        `;

        const values = [
            name,
            category,
            price,
            stock,
            req.params.id
        ];

        db.query(sql, values, (err) => {
            if (err) {
                console.error(
                    'Update product error:',
                    err
                );

                req.flash(
                    'error',
                    'Could not update product.'
                );

                return res.redirect('/products');
            }

            req.flash(
                'success',
                'Product updated successfully!'
            );

            res.redirect('/products');
        });
    }
);

app.get(
    '/products/delete/:id',
    checkAuthenticated,
    checkRole('admin'),
    (req, res) => {
        const sql = `
            DELETE FROM products
            WHERE id = ?
        `;

        db.query(
            sql,
            [req.params.id],
            (err) => {
                if (err) {
                    console.error(
                        'Delete product error:',
                        err
                    );

                    req.flash(
                        'error',
                        'Could not delete product.'
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

// ==================================================
// C237-MAIN CODE ADDED BELOW CA2 CODE
// ==================================================

// C237-main originally used a variable called "connection".
// This lets the C237 code use the same CA2 database connection.
const connection = db;

// ==================================================
// MULTER IMAGE-UPLOAD SETUP — C237-MAIN
// ==================================================

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

// Placeholder retained from C237-main.
const currentUserId = 1;

// ==================================================
// EDIT PRODUCT — C237-MAIN
// ==================================================

app.get('/editProduct/:id', (req, res) => {
    const productId = req.params.id;

    const sql = `
        SELECT *
        FROM products
        WHERE product_id = ?
    `;

    connection.query(
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

            if (results.length > 0) {
                res.render('editProduct', {
                    product: results[0]
                });
            } else {
                res.send('Product not found');
            }
        }
    );
});

app.post(
    '/editProduct/:id',
    upload.single('image'),
    (req, res) => {
        const productId = req.params.id;

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
            category_other &&
            category_other.trim() !== ''
        ) {
            finalCategory = category_other.trim();
        }

  let image = req.body.currentImage;
  if (req.body.removeImage === 'yes') {
  image = null;
} else if (req.file) {
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

        connection.query(
            sql,
            values,
            (error) => {
                if (error) {
                    console.error(
                        'Error updating product:',
                        error
                    );

                    return res.send(
                        'Error updating product'
                    );
                }

                res.redirect('/products');
            }
        );
    }
);

// ==================================================
// SEARCH AND FILTER — C237-MAIN
// ==================================================

app.get('/searchProducts', (req, res) => {
    const sql = 'SELECT * FROM products';

    connection.query(sql, (error, results) => {
        if (error) {
            console.error(
                'Error retrieving products:',
                error
            );

            return res.send(
                'Error retrieving products'
            );
        }

        res.render('searchProducts', {
            products: results,
            searchName: '',
            searchCategory: ''
        });
    });
});

app.post('/searchProducts', (req, res) => {
    const {
        searchName,
        searchCategory
    } = req.body;

    let sql = 'SELECT * FROM products';
    let values = [];

    if (searchName && searchCategory) {
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

    connection.query(
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

            res.render('searchProducts', {
                products: results,
                searchName: searchName,
                searchCategory: searchCategory
            });
        }
    );
});

// ==================================================
// LOGOUT — CA2 CODE
// ==================================================

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// ==================================================
// SERVER — ONLY ONE APP.LISTEN
// ==================================================

app.listen(3000, () => {
    console.log(
        'ResellVault running on port http://localhost:3000/'
    );
});