/*
 * The retry count tests can only be individually executed with
 * their own test file since the retry count variable will not be
 * consistent throughout the multiply defined tests within a single
 * test file.  Thus, the need to create a separate test file for
 * each single retry count test.
 */

const { execute_retry_count_test } = require('./retry.count')

// Set test limit to 60 seconds
jest.setTimeout(60000)

execute_retry_count_test('3', '3.46.1', '2024', 'RETRY_COUNT_5')
