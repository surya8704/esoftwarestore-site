export function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay)
      return
    }

    const existing = document.querySelector('script[src*="checkout.razorpay.com"]')
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Razorpay) resolve(window.Razorpay)
        else reject(new Error('Razorpay checkout failed to load'))
      })
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout failed to load')))
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay)
      else reject(new Error('Razorpay checkout failed to load'))
    }
    script.onerror = () => reject(new Error('Razorpay checkout failed to load'))
    document.body.appendChild(script)
  })
}

export function openRazorpayCheckout(Razorpay, options) {
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: {
        ...options.modal,
        ondismiss: () => {
          options.modal?.ondismiss?.()
          reject(new Error('Payment cancelled'))
        },
      },
    })

    rzp.on('payment.failed', (response) => {
      const message = response.error?.description ?? 'Payment failed'
      reject(new Error(message))
    })

    rzp.open()
  })
}
