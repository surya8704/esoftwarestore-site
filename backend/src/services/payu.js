import crypto from 'node:crypto'
import { config } from '../config.js'

function sha512(value) {
  return crypto.createHash('sha512').update(value).digest('hex').toLowerCase()
}

export function formatPayuAmount(amount) {
  return Number(amount).toFixed(2)
}

export function generatePayuTxnId() {
  const raw = `ES${Date.now()}${crypto.randomBytes(4).toString('hex')}`
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25)
}

export function generatePaymentHash(params, salt) {
  const {
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = '',
  } = params

  const hashString = [
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|')

  return sha512(hashString)
}

export function validateResponseHash(response, salt) {
  const {
    hash,
    status,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1 = '',
    udf2 = '',
    udf3 = '',
    udf4 = '',
    udf5 = '',
    key,
    additionalCharges,
  } = response

  if (!hash) return false

  const emptyFields = ['', '', '', '', '']

  const parts = additionalCharges
    ? [additionalCharges, salt, status, ...emptyFields, udf5, udf4, udf3, udf2, udf1, email, firstname, productinfo, amount, txnid, key]
    : [salt, status, ...emptyFields, udf5, udf4, udf3, udf2, udf1, email, firstname, productinfo, amount, txnid, key]

  const expected = sha512(parts.join('|'))
  return expected === String(hash).toLowerCase()
}

export function buildPayuPaymentParams({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  phone,
  udf1,
  surl,
  furl,
  address1,
  city,
  state,
  country,
  zipcode,
}) {
  const key = config.payuMerchantKey
  const salt = config.payuMerchantSalt
  const formattedAmount = formatPayuAmount(amount)
  const safeProduct = String(productinfo ?? 'Software license').replace(/\|/g, ' ').slice(0, 100)

  const params = {
    key,
    txnid,
    amount: formattedAmount,
    productinfo: safeProduct,
    firstname: String(firstname ?? 'Customer').slice(0, 60),
    email,
    phone: String(phone ?? '').slice(0, 15),
    surl,
    furl,
    udf1: String(udf1 ?? ''),
    service_provider: 'payu_paisa',
  }

  if (address1) params.address1 = address1.slice(0, 100)
  if (city) params.city = city.slice(0, 60)
  if (state) params.state = state.slice(0, 60)
  if (country) params.country = country.slice(0, 60)
  if (zipcode) params.zipcode = zipcode.slice(0, 20)

  params.hash = generatePaymentHash(
    {
      key,
      txnid,
      amount: formattedAmount,
      productinfo: safeProduct,
      firstname: params.firstname,
      email,
      udf1: params.udf1,
    },
    salt,
  )

  return params
}

export function getPayuPaymentUrl() {
  return config.payuEnv === 'production'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment'
}
