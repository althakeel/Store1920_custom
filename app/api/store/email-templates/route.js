import dbConnect from '@/lib/mongodb'
import EmailTemplate from '@/models/EmailTemplate'
import authSeller from '@/middlewares/authSeller'
import { NextResponse } from 'next/server'

// Default product notification template
const DEFAULT_TEMPLATE = {
  subject: 'New Product Alert: {{productName}}',
  template: `
    <div style="font-family: Arial, sans-serif; max-width: 620px; width: 100%; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0;">🎉 New Product Arrived!</h1>
      </div>
      
      <div style="padding: 30px; background: #f9f9f9;">
        <p style="font-size: 16px; color: #333;">Hi {{customerName}},</p>
        
        <p style="font-size: 14px; color: #666;">We're excited to announce a new product that just arrived:</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <div style="display: flex; gap: 15px;">
            {{#if productImage}}
            <img src="{{productImage}}" alt="{{productName}}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">
            {{/if}}
            <div style="flex: 1;">
              <h2 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">{{productName}}</h2>
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">{{productDescription}}</p>
              <p style="margin: 0; color: #667eea; font-size: 24px; font-weight: bold;">AED{{productPrice}}</p>
            </div>
          </div>
        </div>
        
        {{#if customMessage}}
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #333; font-size: 14px;">{{customMessage}}</p>
        </div>
        {{/if}}
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{shopUrl}}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Shop Now</a>
        </div>
        
        <p style="font-size: 12px; color: #999; margin: 20px 0 0 0; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          You're receiving this email because you're a valued customer of our store. 
          <a href="{{preferencesUrl}}" style="color: #667eea; text-decoration: none;">Manage your preferences</a>
        </p>
      </div>
    </div>
  `
}

export async function GET(request) {
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

    await dbConnect()
    
    // Get all templates for this store
    let templates = await EmailTemplate.find({ storeId, templateType: 'product_notification' })

    // If no templates exist, create default template
    if (templates.length === 0) {
      const defaultTemplate = await EmailTemplate.create({
        storeId,
        templateType: 'product_notification',
        name: 'Default Product Notification',
        isDefault: true,
        ...DEFAULT_TEMPLATE,
        placeholders: [
          { name: '{{productName}}', description: 'Product name' },
          { name: '{{productPrice}}', description: 'Product price' },
          { name: '{{productDescription}}', description: 'Product description' },
          { name: '{{productImage}}', description: 'Product image URL' },
          { name: '{{customerName}}', description: 'Customer name' },
          { name: '{{customMessage}}', description: 'Custom message from store' },
          { name: '{{shopUrl}}', description: 'Link to shop product' },
          { name: '{{preferencesUrl}}', description: 'Link to manage preferences' }
        ]
      })
      templates = [defaultTemplate]
    }

    return NextResponse.json({ templates })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

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

    await dbConnect()
    
    const template = await EmailTemplate.create({
      storeId,
      templateType: 'product_notification',
      name: body.name,
      subject: body.subject,
      template: body.template,
      placeholders: body.placeholders || [],
      isDefault: false
    })

    return NextResponse.json({ template }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
