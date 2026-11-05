// Types a synthetic e2e account's credentials into the native sign-in form without printing them.
// Usage: node login.cjs <user> <emailX> <emailY> <pwX> <pwY> <btnX> <btnY>
const { execFileSync } = require('node:child_process'), path = require('node:path'), fs = require('node:fs')
const SERIAL = process.env.JM_TEST_DEVICE || 'emulator-5554'
if (!/^emulator-\d+$/.test(SERIAL)) throw Error('emulator only')
const acc = JSON.parse(fs.readFileSync(process.env.JM_E2E_ACCOUNTS, 'utf8').replace(/^﻿/, ''))
const [user, ex, ey, px, py, bx, by] = process.argv.slice(2)
const a = acc.accounts[user]; if (!a) throw Error('no account ' + user)
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe')
const adb = (...x) => execFileSync(adbPath, ['-s', SERIAL, ...x], { timeout: 180000 })
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const esc = s => s.replace(/ /g, '%s').replace(/([\\@&;<>()$|'"!#*?~`{}\[\]^])/g, '\\$1')
const type = s => { adb("shell", "input", "text", esc(s)) }
adb('shell', 'input', 'tap', ex, ey); sleep(1500); adb('shell', 'input', 'keycombination', '113', '29'); adb('shell', 'input', 'keyevent', '67'); type(a.email); sleep(300)
adb('shell', 'input', 'tap', px, py); sleep(1500); adb('shell', 'input', 'keycombination', '113', '29'); adb('shell', 'input', 'keyevent', '67'); type(a.password); sleep(300)
adb('shell', 'input', 'keyevent', '4'); sleep(600)
if (bx) adb('shell', 'input', 'tap', bx, by)
console.log('submitted for', user)
