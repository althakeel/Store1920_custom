import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Product from '@/models/Product';
import Store from '@/models/Store';
import EmailHistory from '@/models/EmailHistory';
import { sendMail } from '@/lib/email';
import { getRandomTemplate, getTemplateById, getAllTemplateIds } from '@/lib/promotionalEmailTemplates';
import mongoose from 'mongoose';

/**
 * API endpoint to send promotional emails
 * GET - Send to random customers with random template
 * POST - Send specific template to specific customers
 */

export async function GET(request) {
  try {
    // Get random template
    const template = getRandomTemplate();
    
    // Connect to database
    await connectDB();

    const storeObjectId = await resolveStoreObjectId();
    
    // Get customers (limit to avoid spam)
    const customers = await User.find({ 
      email: { $exists: true, $ne: null, $ne: '' },
      'emailPreferences.promotional': { $ne: false }
    })
    .limit(50) // Send to 50 customers at a time
    .select('email name')
    .lean();

    if (customers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No customers found with valid emails' 
      }, { status: 404 });
    }

    // Get featured products with complete details
    const featuredProducts = await Product.find({ 
      inStock: true,
      stockQuantity: { $gt: 0 }
    })
    .sort({ createdAt: -1 })
    .limit(4)
    .select('_id name slug price mrp AED images description category stockQuantity')
    .lean();

    const products = featuredProducts.map(p => ({
      id: p._id.toString(),
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      category: p.category || 'Product',
      price: p.price,
      originalPrice: p.AED || null,
      image: p.images && p.images[0] ? p.images[0] : null,
      images: p.images || [],
      stock: p.stockQuantity || 0
    }));

    // Send emails
    const results = [];
    for (const customer of customers) {
      try {
        const htmlContent = template.template(products, customer.email);
        
        // Personalize subject with customer name
        const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'there';
        const personalizedSubject = `HEY ${customerFirstName.toUpperCase()}! ${template.subject}`;
        
        await sendMail({
          to: customer.email,
          subject: personalizedSubject,
          html: htmlContent,
          fromType: 'marketing',
          tags: [{ name: 'category', value: 'promotional' }],
          headers: {
            'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_BASE_URL || 'https://Store1920.com'}/settings?unsubscribe=promotional&email=${encodeURIComponent(customer.email)}>`,
            'X-Campaign': template.id
          }
        });

        if (storeObjectId) {
          try {
            await EmailHistory.create({
              storeId: storeObjectId,
              type: 'promotional',
              recipientEmail: customer.email,
              recipientName: customer.name || 'Customer',
              subject: personalizedSubject,
              status: 'sent',
              customMessage: `template:${template.id}`,
              sentAt: new Date()
            });
          } catch (historyError) {
            console.error('[promotional-email] Failed to save email history:', historyError);
          }
        }
        
        results.push({ 
          email: customer.email, 
          status: 'sent',
          template: template.id 
        });
        
        // Rate limiting: Wait 600ms between emails (max 2 requests/second)
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error) {
        console.error(`Failed to send email to ${customer.email}:`, error);
        if (storeObjectId) {
          try {
            await EmailHistory.create({
              storeId: storeObjectId,
              type: 'promotional',
              recipientEmail: customer.email,
              recipientName: customer.name || 'Customer',
              subject: template.subject,
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              customMessage: `template:${template.id}`,
              sentAt: new Date()
            });
          } catch (historyError) {
            console.error('[promotional-email] Failed to save failed email history:', historyError);
          }
        }
        results.push({ 
          email: customer.email, 
          status: 'failed',
          error: error.message 
        });
      }
    }

    const emailsSent = results.filter(r => r.status === 'sent').length;
    const emailsFailed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        subject: template.subject
      },
      totalCustomers: customers.length,
      emailsSent,
      emailsFailed,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Error sending promotional emails:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { templateId, customerEmails, limit = 50 } = body;

    // Validate template
    const template = templateId ? getTemplateById(templateId) : getRandomTemplate();
    
    if (!template) {
      return NextResponse.json({ 
        success: false, 
        error: 'Template not found',
        availableTemplates: getAllTemplateIds()
      }, { status: 400 });
    }

    await connectDB();

    const storeObjectId = await resolveStoreObjectId();

    // Get customers based on provided emails or fetch from database
    let customers;
    if (customerEmails && Array.isArray(customerEmails) && customerEmails.length > 0) {
      customers = await User.find({ 
        email: { $in: customerEmails },
        'emailPreferences.promotional': { $ne: false }
      })
      .select('email name')
      .lean();
    } else {
      customers = await User.find({ 
        email: { $exists: true, $ne: null, $ne: '' },
        'emailPreferences.promotional': { $ne: false }
      })
      .limit(limit)
      .select('email name')
      .lean();
    }

    if (customers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No customers found' 
      }, { status: 404 });
    }

    // Get featured products with complete details
    const featuredProducts = await Product.find({ 
      inStock: true,
      stockQuantity: { $gt: 0 }
    })
    .sort({ createdAt: -1 })
    .limit(4)
    .select('_id name slug price mrp AED images description category stockQuantity')
    .lean();

    const products = featuredProducts.map(p => ({
      id: p._id.toString(),
      slug: p.slug,
      name: p.name,
      description: p.description || '',
      category: p.category || 'Product',
      price: p.price,
      originalPrice: p.AED || null,
      image: p.images && p.images[0] ? p.images[0] : null,
      images: p.images || [],
      stock: p.stockQuantity || 0
    }));

    // Send emails
    const results = [];
    for (const customer of customers) {
      try {
        const htmlContent = template.template(products, customer.email);
        
        // Personalize subject with customer name
        const customerFirstName = customer.name ? customer.name.split(' ')[0] : 'there';
        const personalizedSubject = `HEY ${customerFirstName.toUpperCase()}! ${template.subject}`;
        
        await sendMail({
          to: customer.email,
          subject: personalizedSubject,
          html: htmlContent,
          fromType: 'marketing',
          tags: [{ name: 'category', value: 'promotional' }],
          headers: {
            'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_BASE_URL || 'https://Store1920.com'}/settings?unsubscribe=promotional&email=${encodeURIComponent(customer.email)}>`,
            'X-Campaign': template.id
          }
        });

        if (storeObjectId) {
          try {
            await EmailHistory.create({
              storeId: storeObjectId,
              type: 'promotional',
              recipientEmail: customer.email,
              recipientName: customer.name || 'Customer',
              subject: personalizedSubject,
              status: 'sent',
              customMessage: `template:${template.id}`,
              sentAt: new Date()
            });
          } catch (historyError) {
            console.error('[promotional-email] Failed to save email history:', historyError);
          }
        }
        
        results.push({ 
          email: customer.email, 
          status: 'sent',
          template: template.id 
        });
        
        // Rate limiting: Wait 600ms between emails (max 2 requests/second)
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error) {
        console.error(`Failed to send email to ${customer.email}:`, error);
        if (storeObjectId) {
          try {
            await EmailHistory.create({
              storeId: storeObjectId,
              type: 'promotional',
              recipientEmail: customer.email,
              recipientName: customer.name || 'Customer',
              subject: template.subject,
              status: 'failed',
              errorMessage: error.message || 'Unknown error',
              customMessage: `template:${template.id}`,
              sentAt: new Date()
            });
          } catch (historyError) {
            console.error('[promotional-email] Failed to save failed email history:', historyError);
          }
        }
        results.push({ 
          email: customer.email, 
          status: 'failed',
          error: error.message 
        });
      }
    }

    const emailsSent = results.filter(r => r.status === 'sent').length;
    const emailsFailed = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        subject: template.subject
      },
      totalCustomers: customers.length,
      emailsSent,
      emailsFailed,
      results: process.env.NODE_ENV === 'development' ? results : undefined
    });

  } catch (error) {
    console.error('Error sending promotional emails:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function resolveStoreObjectId() {
  const envStoreId = process.env.PROMOTIONAL_STORE_ID;
  let storeId = envStoreId;
  if (!storeId) {
    const store = await Store.findOne({}).select('_id').lean();
    storeId = store?._id?.toString();
  }
  if (!storeId) return null;
  return new mongoose.Types.ObjectId(storeId);
}
