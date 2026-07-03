export function submitPayuForm(action, params) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  form.acceptCharset = 'UTF-8'

  Object.entries(params).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value ?? ''
    form.appendChild(input)
  })

  document.body.appendChild(form)
  form.submit()
}
