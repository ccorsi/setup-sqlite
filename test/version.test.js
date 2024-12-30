const setup = require('../src/setup')

test('correct year using X.Y.Z', () => {
    let [ version, _ ] = setup.formatVersion('3.40.0')
    expect(version).toBe('3400000')
})

test('correct year using X.Y.Z.M', () => {
    let [ version, _ ] = setup.formatVersion('3.35.0.0')
    expect(version).toBe('3350000')
})

test('incorrect year format using non-numeric', () => {
    let call = () => { setup.formatVersion('a.b.c') }
    expect(call).toThrow(Error)
})

test('incorrect year format using numeric and non-numeric', () => {
    let call = () => { setup.formatVersion('3.b.0') }
    expect(call).toThrow(Error)
})

test('correct year with greater than two digit major version', () => {
    let [ version, _ ] = setup.formatVersion('101.35.0.0')
    expect(version).toBe('101350000')
})
