const q = require('q')
const dbConnection = require('../configs/dbConnection')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const config = require('../configs/config')

module.exports = {
    register: register,
    login: login,
    checkSecondaryPass: checkSecondaryPass,
    changePassword: changePassword,
    getMyFavorites: getMyFavorites,
    checkUserbyToken: checkUserbyToken
}

/**
 * 
 * @param {Object} userData 
 * @returns {Promise} Promise for the results
 */
function register(userData) {
    let defers = q.defer()
    function addFavorite(user) {
        user.favorites = {}
    }
    function addBooks(user) {
        user.books = {}
    }
    dbConnection((db) => {
        db.collection('clients')
            .findOne({username: userData.username}, (err, result) => {
                if ( result ) {
                    console.log(result)
                    defers.resolve({
                        status: false,
                        err_type: config.INVALID_PARAMS_ERR_TYPE,
                        message: "Username already taken by someone"
                    })
                } else {
                    bcrypt.genSalt(config.saltRounds, (err, result) => {
                        bcrypt.hash(userData.password, result, (err, hash) => {
                            if ( err ) {
                                console.log(userData.password)
                                console.log(err)
                                console.log(result)
                                defers.reject("Internal Error")
                            } else {
                                userData.password = hash
                                addFavorite(userData)
                                addBooks(userData)
                                createUser(userData, (err, result) => {
                                    if ( err ) {
                                        defers.resolve({
                                            err
                                        })
                                    } else {
                                        defers.resolve(result)
                                    }
                                })
                            }
                        })
                    })
                }
            })
    })

    return defers.promise
}

/**
 * 
 * @param {string} user username 
 * @param {string} secondaryPass secondary pass to change the primary one 
 */
function checkSecondaryPass(user, secondaryPass) {
    let defers = q.defer()
    dbConnection((db) => {
        db.collection('clients')
            .findOne({username: user}, (err, result) => {
                if(err) {
                    defers.resolve({
                        status: false,
                        err_type: config.DB_ERR_TYPE,
                        message: "There's something error with our system. Please try it again later"
                    })
                } else {
                    if ( secondaryPass == result.sec_password ) {
                        defers.resolve({
                            status: true,
                            message: "Access granted"
                        })
                    } else {
                        defers.resolve({
                            status: false,
                            err_type: config.INVALID_PARAMS_ERR_TYPE,
                            message: "Your secondary password is not valid. Try it again"
                        })
                    }
                }
            })
    })

    return defers.promise
}

/**
 * 
 * @param {string} username 
 * @param {string} new_password new password to add 
 */
function changePassword(username, new_password) {
    let defers = q.defer()
    bcrypt.genSalt(config.saltRounds, (err, res) => {
        bcrypt.hash(new_password, res, (err, hash) => {
            dbConnection((db) => {
                db.collection('clients')
                    .updateOne({username: username}, {$set: {password: hash}}, (err, result) => {
                        if( err ) {
                            defers.resolve({
                                status: false,
                                err_type: config.DB_ERR_TYPE,
                                message: "There's something error with our system. Please try it again later"
                            })
                        }
                        if ( result ) {
                            defers.resolve({
                                status: true,
                                message: "Please login with your new password"
                            })
                        }
                    })
            })
        })
    })
    return defers.promise
}

/**
 * 
 * @param {string} username  
 */
function getMyFavorites(username) {
    let defers = q.defer()
    dbConnection((db) => {
        db.collection('clients')
            .findOne({username: username}, (err, result) => {
                if ( err ) {
                    defers.resolve({
                        status: false,
                        err_type: config.DB_ERR_TYPE,
                        message: "We got problem on our database. Please try it again later"
                    })
                } else {
                    if ( result ) {
                        let fav = result.favorites
                        defers.resolve({
                            status: true,
                            data: fav
                        })
                    }
                }
            })
    })

    return defers.promise
}

/**
 * 
 * @param {Object} user {username, password} 
 * @returns {Promise} The user succeed login data
 */
function login(user) {
    let defers = q.defer()
    dbConnection((db) => {
        db.collection('clients')
            .findOne({username: user.username}, (err, response) => {
                if (err) {
                    defers.resolve({
                        status: false,
                        err_type: config.DB_ERR_TYPE,
                        message: "There's an internal error. Please try it again later"
                    })
                }
                if ( response ) {
                    bcrypt.compare(user.password, response.password, (err, result) => {
                        if ( err ) {
                            defers.resolve({
                                status: false,
                                err_type: "unknown",
                                message: "There's an internal error. Please try it again later"
                            })
                        }
                        if ( result ) {
                            let token = jwt.sign({username: response.username}, config.secret_key, {
                                expiresIn: 86400
                            })
                            defers.resolve({
                                status: true,
                                message: "Welcome to barberros, " + response.full_name,
                                username: response.username,
                                full_name: response.full_name,
                                token: token
                            })
                        } else {
                            defers.resolve({
                                status: false,
                                err_type: config.INVALID_PARAMS_ERR_TYPE,
                                message: "Your password is invalid. Please check it back"
                            })
                        }
                    })
                } else {
                    defers.resolve({
                        status: false,
                        err_type: config.INVALID_PARAMS_ERR_TYPE,
                        message: "Your username is invalid. Please check it back"
                    })
                }
            })
    })
    return defers.promise
}



/**
 * 
 * @param {Object} user User data 
 * @param {Function} callback function callback 
 */
function createUser(user, callback) {
    dbConnection((db) => {
        db.collection('clients')
            .insertOne(user, (err, result) => {
                if ( err ) {
                    let error = {
                        status: false,
                        err_type: config.DB_ERR_TYPE,
                        message: "Error on putting the data to the databse"
                    }
                    callback(error, null)
                } else {
                    callback(null, {
                        status: true,
                        message: "Register succeed"
                    })
                }
            })
    })
}

function checkUserbyToken(username, callback) {
    dbConnection((db) => {
        db.collection('clients')
            .findOne({username: username}, (err, result) => {
                if (result) {
                    callback(true)
                } else {
                    callback(false)
                }
            })
    })
}