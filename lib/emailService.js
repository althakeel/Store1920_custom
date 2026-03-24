import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT || 587);

// Create transporter - configure with your email service
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendTicketCreatedEmail(ticket) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@brandstored.com';
  
  try {
    // Email to customer
    await transporter.sendMail({
      from: `"QuickFynd Support" <${process.env.SMTP_USER}>`,
      to: ticket.userEmail,
      subject: `Ticket Created: ${ticket.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Support Ticket Created</h2>
          <p>Hello ${ticket.userName},</p>
          <p>Your support ticket has been created successfully.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticket._id}</p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
            <p style="margin: 5px 0;"><strong>Category:</strong> ${ticket.category}</p>
            <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="text-transform: uppercase; color: ${getPriorityColor(ticket.priority)};">${ticket.priority}</span></p>
            <p style="margin: 5px 0;"><strong>Status:</strong> ${ticket.status}</p>
          </div>
          
          <p><strong>Description:</strong></p>
          <p style="background-color: #f9fafb; padding: 10px; border-left: 3px solid #2563eb;">${ticket.description}</p>
          
          <p>Our support team will respond to your ticket as soon as possible.</p>
          <p>You can view and reply to your ticket anytime from your dashboard.</p>
          
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/tickets/${ticket._id}" 
             style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
            View Ticket
          </a>
          
          <p style="color: #6b7280; font-size: 14px;">
            Best regards,<br/>
            QuickFynd Support Team
          </p>
        </div>
      `
    });

    // Email to admin
    await transporter.sendMail({
      from: `"QuickFynd Support" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `New Support Ticket: ${ticket.subject} [${ticket.priority.toUpperCase()}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">New Support Ticket</h2>
          
          <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="text-transform: uppercase; color: ${getPriorityColor(ticket.priority)}; font-weight: bold;">${ticket.priority}</span></p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticket._id}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${ticket.userName} (${ticket.userEmail})</p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
            <p style="margin: 5px 0;"><strong>Category:</strong> ${ticket.category}</p>
            <p style="margin: 5px 0;"><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
          </div>
          
          <p><strong>Description:</strong></p>
          <p style="background-color: #f9fafb; padding: 10px; border-left: 3px solid #dc2626;">${ticket.description}</p>
          
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/store/tickets" 
             style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px;">
            View in Admin Panel
          </a>
        </div>
      `
    });

    console.log('Ticket creation emails sent successfully');
  } catch (error) {
    console.error('Error sending ticket creation emails:', error);
    // Don't throw - we don't want email failure to block ticket creation
  }
}

export async function sendTicketReplyEmail(ticket, reply) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@brandstored.com';
  
  try {
    if (reply.sender === 'admin') {
      // Admin replied - notify customer
      await transporter.sendMail({
        from: `"QuickFynd Support" <${process.env.SMTP_USER}>`,
        to: ticket.userEmail,
        subject: `New Reply to Your Ticket: ${ticket.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Reply from Support Team</h2>
            <p>Hello ${ticket.userName},</p>
            <p>Our support team has replied to your ticket.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Ticket:</strong> ${ticket.subject}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> ${ticket.status}</p>
            </div>
            
            <p><strong>Support Team Reply:</strong></p>
            <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border-left: 3px solid #2563eb; margin: 20px 0;">
              ${reply.message}
            </div>
            
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/tickets/${ticket._id}" 
               style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View & Reply
            </a>
            
            <p style="color: #6b7280; font-size: 14px;">
              Best regards,<br/>
              QuickFynd Support Team
            </p>
          </div>
        `
      });
    } else {
      // Customer replied - notify admin
      await transporter.sendMail({
        from: `"QuickFynd Support" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `Customer Reply: ${ticket.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ea580c;">Customer Reply</h2>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Ticket ID:</strong> ${ticket._id}</p>
              <p style="margin: 5px 0;"><strong>Customer:</strong> ${ticket.userName} (${ticket.userEmail})</p>
              <p style="margin: 5px 0;"><strong>Subject:</strong> ${ticket.subject}</p>
              <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="text-transform: uppercase;">${ticket.priority}</span></p>
            </div>
            
            <p><strong>Customer's Reply:</strong></p>
            <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border-left: 3px solid #ea580c; margin: 20px 0;">
              ${reply.message}
            </div>
            
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/store/tickets" 
               style="display: inline-block; margin: 20px 0; padding: 12px 24px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 6px;">
              View & Reply
            </a>
          </div>
        `
      });
    }

    console.log('Ticket reply email sent successfully');
  } catch (error) {
    console.error('Error sending ticket reply email:', error);
  }
}

function getPriorityColor(priority) {
  const colors = {
    low: '#10b981',
    normal: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444'
  };
  return colors[priority] || colors.normal;
}
