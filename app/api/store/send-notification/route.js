import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import EmailHistory from '@/models/EmailHistory'
import authSeller from '@/middlewares/authSeller'
import { NextResponse } from 'next/server'
import { sendMail } from '@/lib/email'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    let userId = null
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split(' ')[1]
      const { getAuth } = await import('firebase-admin/auth')
      const { initializeApp, getApps } = await import('firebase-admin/app')
      if (getApps().length === 0) {
        initializeApp()
      }
      try {
        const decodedToken = await getAuth().verifyIdToken(idToken)
        userId = decodedToken.uid
      } catch (e) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

    const body = await request.json()
    const { type, product, customerIds, additionalEmails, customMessage } = body

    // Combine customerIds and additionalEmails
    const hasCustomers = customerIds && customerIds.length > 0
    const hasAdditionalEmails = additionalEmails && additionalEmails.length > 0

    if (!hasCustomers && !hasAdditionalEmails) {
      return NextResponse.json({ message: 'No recipients selected' }, { status: 400 })
    }

    await dbConnect()

    console.log('[send-notification] Received customerIds:', customerIds)
    console.log('[send-notification] Additional emails:', additionalEmails)

    // Fetch customer emails from registered users
    const validUserIds = (customerIds || []).filter(id => 
      id && !id.startsWith('guest-') && !id.startsWith('unknown-')
    )
    
    console.log('[send-notification] Valid user IDs to fetch:', validUserIds)
    
    let users = []
    if (validUserIds.length > 0) {
      users = await User.find({ _id: { $in: validUserIds } }, 'email name').lean()
    }

    console.log('[send-notification] Found users:', users.length, users.map(u => ({ email: u.email, name: u.name })))

    // Combine registered users and additional emails
    const recipients = [
      ...users.map(u => ({ email: u.email, name: u.name })),
      ...(additionalEmails || []).map(email => ({ email: email, name: 'Customer' }))
    ]

    if (recipients.length === 0) {
      return NextResponse.json({ message: 'No valid recipients found' }, { status: 400 })
    }

    console.log('[send-notification] Total recipients:', recipients.length)

    // Import mongoose for ObjectId conversion
    const mongoose = await import('mongoose');
    const storeObjectId = new mongoose.default.Types.ObjectId(storeId);

    // Send emails using the same sendMail function
    const emailPromises = recipients.map(recipient => {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0;">🎉 New Product Arrived!</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <p style="font-size: 16px; color: #333;">Hi ${recipient.name || 'Valued Customer'},</p>
            
            <p style="font-size: 14px; color: #666;">We're excited to announce a new product that just arrived:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
              <div style="display: flex; gap: 15px;">
                ${
                  product.image
                    ? `<img src="${product.image}" alt="${product.name}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">`
                    : ''
                }
                <div style="flex: 1;">
                  <h2 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">${product.name}</h2>
                  <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${product.description || ''}</p>
                  <p style="margin: 0; color: #667eea; font-size: 24px; font-weight: bold;">AED${product.price}</p>
                </div>
              </div>
            </div>
            
            ${
              customMessage
                ? `<div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #333; font-size: 14px;">${customMessage}</p>
                  </div>`
                : ''
            }
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://Store1920.com/product/${product.slug || product.id}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Shop Now</a>
            </div>
            
            <p style="font-size: 12px; color: #999; margin: 20px 0 0 0; border-top: 1px solid #e0e0e0; padding-top: 20px;">
              You're receiving this email because you're a valued customer of our store. 
              <a href="https://Store1920.com/settings" style="color: #667eea; text-decoration: none;">Manage your preferences</a>
            </p>
          </div>
        </div>
      `;

      return sendMail({
        to: recipient.email,
        subject: `New Product Alert: ${product.name}`,
        html
      }).then(async (result) => {
        // Save success to history
        console.log('[send-notification] Saving email history for:', recipient.email)
        try {
          const historyRecord = await EmailHistory.create({
            storeId: storeObjectId,
            type: 'product_notification',
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: `New Product Alert: ${product.name}`,
            status: 'sent',
            productId: product.id,
            productName: product.name,
            customMessage: customMessage || null,
            sentAt: new Date()
          })
          console.log('[send-notification] Email history saved:', historyRecord._id)
        } catch (err) {
          console.error('[send-notification] Failed to save email history:', err)
        }
        
        return result
      }).catch(async (err) => {
        console.error(`[send-notification] Failed to send email to ${recipient.email}:`, err)
        
        // Save failure to history
        console.log('[send-notification] Saving failed email history for:', recipient.email)
        try {
          const historyRecord = await EmailHistory.create({
            storeId: storeObjectId,
            type: 'product_notification',
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: `New Product Alert: ${product.name}`,
            status: 'failed',
            errorMessage: err.message || 'Unknown error',
            productId: product.id,
            productName: product.name,
            customMessage: customMessage || null,
            sentAt: new Date()
          })
          console.log('[send-notification] Failed email history saved:', historyRecord._id)
        } catch (histErr) {
          console.error('[send-notification] Failed to save email history:', histErr)
        }
        
        return null
      })
    })

    const results = await Promise.all(emailPromises)
    const successCount = results.filter(r => r !== null).length
    
    console.log('[send-notification] Email sending complete. Success:', successCount, 'Total:', recipients.length)

    return NextResponse.json({ 
      message: `Email sent to ${successCount}/${recipients.length} recipient(s)`,
      count: successCount 
    })
  } catch (e) {
    console.error('Error sending notification:', e)
    return NextResponse.json({ message: e.message }, { status: 500 })
  }
}
