import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoSrc from "../assets/Asset11.png";

// Optional: read company details from public env vars (client-safe)
const COMPANY_NAME = process.env.NEXT_PUBLIC_INVOICE_COMPANY_NAME || "Brandstored";
const COMPANY_ADDRESS_LINE1 = process.env.NEXT_PUBLIC_INVOICE_ADDRESS_LINE1 || "kerala, India";
const COMPANY_ADDRESS_LINE2 = process.env.NEXT_PUBLIC_INVOICE_ADDRESS_LINE2 || "";
const COMPANY_CONTACT = process.env.NEXT_PUBLIC_INVOICE_CONTACT || "Email: support@brandstored.com";
// Keep ASCII-only to avoid emoji boxes if custom font fails to load
const THANK_YOU_LINE2 = process.env.NEXT_PUBLIC_INVOICE_QUOTE2 || "We hope you love your purchase!";

// Font config for proper AED rendering and better Unicode support
const UNICODE_FONT_NAME = 'RobotoJPDF';
const UNICODE_FONT_REG_VFS = 'Roboto-Regular.ttf';
const UNICODE_FONT_BOLD_VFS = 'Roboto-Bold.ttf';
// Allow override via env; otherwise use widely available Roboto TTFs
const UNICODE_FONT_REG_URL = process.env.NEXT_PUBLIC_INVOICE_FONT_URL ||
    'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf';
const UNICODE_FONT_BOLD_URL = process.env.NEXT_PUBLIC_INVOICE_FONT_BOLD_URL ||
    'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf';
let unicodeFontLoaded = false;

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

async function ensureUnicodeFont(doc) {
    if (unicodeFontLoaded) {
        try { doc.setFont(UNICODE_FONT_NAME, 'normal'); } catch {}
        return;
    }
    try {
        const [regRes, boldRes] = await Promise.all([
            fetch(UNICODE_FONT_REG_URL),
            fetch(UNICODE_FONT_BOLD_URL)
        ]);
        const [regBuf, boldBuf] = await Promise.all([
            regRes.arrayBuffer(),
            boldRes.arrayBuffer()
        ]);
        const reg64 = arrayBufferToBase64(regBuf);
        const bold64 = arrayBufferToBase64(boldBuf);
        doc.addFileToVFS(UNICODE_FONT_REG_VFS, reg64);
        doc.addFileToVFS(UNICODE_FONT_BOLD_VFS, bold64);
        doc.addFont(UNICODE_FONT_REG_VFS, UNICODE_FONT_NAME, 'normal');
        doc.addFont(UNICODE_FONT_BOLD_VFS, UNICODE_FONT_NAME, 'bold');
        unicodeFontLoaded = true;
        doc.setFont(UNICODE_FONT_NAME, 'normal');
    } catch (e) {
        // If font fails to load, fallback to core font (AED may not render)
    }
}

// helpers
const formatInr = (n) => `AED${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const loadImage = (src) => new Promise((resolve, reject) => {
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    } catch (e) { reject(e); }
});

export const generateInvoice = async (order) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    await ensureUnicodeFont(doc);

    // A4 layout helpers
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = { left: 15, right: 15, top: 15, bottom: 15 };
    const contentWidth = pageWidth - margin.left - margin.right;
    let y = margin.top;

    // Header: Logo
    try {
        const logoUrl = typeof logoSrc === 'string' ? logoSrc : (logoSrc?.src || logoSrc?.default || '');
        const img = await loadImage(logoUrl);
        // Reduced logo height for better proportions
        doc.addImage(img, 'PNG', margin.left, y, 26, 12);
    } catch {
        // ignore if logo missing
    }

    // Header: Company text
    const infoX = margin.left + 30;
    doc.setFontSize(11);
    doc.setFont(UNICODE_FONT_NAME, 'bold');
    doc.text(COMPANY_NAME, infoX, y + 5);
    doc.setFont(UNICODE_FONT_NAME, 'normal');
    doc.setFontSize(9);
    doc.text(`${COMPANY_ADDRESS_LINE1}, ${COMPANY_ADDRESS_LINE2}`, infoX, y + 10);
    doc.text(COMPANY_CONTACT, infoX, y + 15);

    // Header: Invoice title + number
        const orderIdShort = String(order?.id || '').slice(0, 8).toUpperCase();
        doc.setFont(UNICODE_FONT_NAME, 'bold');
        doc.setFontSize(18);
        // Show both INVOICE and order ID together
        doc.text(`INVOICE\n#${orderIdShort}`, pageWidth - margin.right, y + 10, { align: 'right' });

    y += 22;
    // Divider
    doc.setDrawColor(220);
    doc.line(margin.left, y, pageWidth - margin.right, y);
    y += 6;

    // Order meta (two columns)
    const col1X = margin.left;
    const col2X = margin.left + contentWidth / 2 + 5;
    const paid = (String(order?.paymentMethod || '').toUpperCase() === 'STRIPE') ? (order?.isPaid ?? true) : (order?.isPaid ?? false);

    doc.setFont(UNICODE_FONT_NAME, 'bold'); doc.setFontSize(9);
    doc.text('Invoice Date:', col1X, y);
    doc.text('Payment Method:', col1X, y + 6);
    doc.text('Payment Status:', col2X, y);
    doc.text('Order Status:', col2X, y + 6);

    doc.setFont(UNICODE_FONT_NAME, 'normal');
    doc.text(new Date(order?.createdAt || Date.now()).toLocaleDateString('en-IN'), col1X + 32, y);
    doc.text(String(order?.paymentMethod || '').toUpperCase(), col1X + 32, y + 6);
    doc.text(paid ? 'PAID' : 'UNPAID', col2X + 30, y);
    doc.text(String(order?.status || '').replace(/_/g, ' ').toUpperCase(), col2X + 30, y + 6);

    y += 14;

    // Bill To (left)
    doc.setFont(UNICODE_FONT_NAME, 'bold'); doc.setFontSize(11);
    doc.text('BILL TO', margin.left, y);
    doc.setFontSize(10); doc.text(String(order?.address?.name || 'Customer'), margin.left, y + 8);
    doc.setFont(UNICODE_FONT_NAME, 'normal'); doc.setFontSize(9);
    doc.text(String(order?.address?.street || ''), margin.left, y + 14);
    doc.text(`${order?.address?.city || ''}, ${order?.address?.state || ''} - ${order?.address?.zip || ''}`, margin.left, y + 20);
    doc.text(String(order?.address?.country || 'India'), margin.left, y + 26);
    const phoneCode = order?.address?.phoneCode || order?.shippingAddress?.phoneCode || '+91';
    const phone = order?.address?.phone || order?.shippingAddress?.phone || 'N/A';
    doc.text(`Phone: ${phoneCode} ${phone}`, margin.left, y + 32);
    // Show alternate phone if available
    if (order?.address?.alternatePhone || order?.shippingAddress?.alternatePhone) {
        const altCode = order?.address?.alternatePhoneCode || order?.shippingAddress?.alternatePhoneCode || phoneCode;
        const altPhone = order?.address?.alternatePhone || order?.shippingAddress?.alternatePhone;
        doc.text(`Alternate: ${altCode} ${altPhone}`, margin.left, y + 38);
        y += 6; // Add spacing when alternate phone is shown
    }

    // Tracking (right)
    if (order?.trackingId) {
        doc.setFont(UNICODE_FONT_NAME, 'bold'); doc.setFontSize(11);
        doc.text('TRACKING DETAILS', margin.left + contentWidth / 2 + 5, y);
        doc.setFont(UNICODE_FONT_NAME, 'normal'); doc.setFontSize(9);
        doc.text(`Tracking ID: ${order.trackingId}`, margin.left + contentWidth / 2 + 5, y + 8);
        if (order?.courier) doc.text(`Courier: ${order.courier}`, margin.left + contentWidth / 2 + 5, y + 14);
        if (order?.trackingUrl) {
            doc.setTextColor(0, 102, 204);
            doc.textWithLink('Track Order', margin.left + contentWidth / 2 + 5, y + 20, { url: order.trackingUrl });
            doc.setTextColor(0, 0, 0);
        }
    }

    y += 40;

    // Items table
    const tableData = (order?.orderItems || []).map((item, i) => [
        i + 1,
        item?.product?.name || 'Product',
        item?.quantity ?? 0,
        formatInr(item?.price ?? 0),
        formatInr((item?.price ?? 0) * (item?.quantity ?? 0))
    ]);

    autoTable(doc, {
        startY: y,
        head: [["#", "Product Name", "Qty", "Price", "Total"]],
        body: tableData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 4, font: UNICODE_FONT_NAME },
        headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold', lineWidth: 0.2, lineColor: 220 },
        bodyStyles: { lineWidth: 0.2, lineColor: 230 },
        margin: { left: margin.left, right: margin.right },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: contentWidth - (15 + 20 + 30 + 35) },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 35, halign: 'right' }
        }
    });

    const tableBottom = doc.lastAutoTable?.finalY || y;
    const subtotal = (order?.orderItems || []).reduce((sum, it) => sum + ((it?.price ?? 0) * (it?.quantity ?? 0)), 0);
    const shippingFee = Number(order?.shippingFee ?? order?.shipping ?? 0);
    let discount = 0;
    if (order?.isCouponUsed && order?.coupon) {
        discount = order.coupon.discountType === 'percentage'
            ? (Number(order.coupon.discount || 0) / 100) * subtotal
            : Number(order.coupon.discount || 0);
    }

    const finalY = tableBottom + 8;

    // Totals (right-aligned)
    doc.setFont(UNICODE_FONT_NAME, 'normal'); doc.setFontSize(10);
    const rightX = pageWidth - margin.right;
    const labelX = rightX - 40;
    doc.text('Subtotal:', labelX, finalY);
    doc.text(formatInr(subtotal), rightX, finalY, { align: 'right' });
    doc.text('Shipping:', labelX, finalY + 7);
    doc.text(formatInr(shippingFee), rightX, finalY + 7, { align: 'right' });
    if (discount > 0) {
        doc.text(`Discount:`, labelX, finalY + 14);
        doc.setTextColor(34, 197, 94);
        doc.text(`-${formatInr(discount)}`, rightX, finalY + 14, { align: 'right' });
        doc.setTextColor(0, 0, 0);
    }

    doc.setFont(UNICODE_FONT_NAME, 'bold'); doc.setFontSize(12);
    const totalY = discount > 0 ? finalY + 21 : finalY + 14;
    doc.text('TOTAL:', labelX, totalY);
    doc.text(formatInr(order?.total ?? (subtotal + shippingFee - discount)), rightX, totalY, { align: 'right' });

    // Footer
    doc.setDrawColor(230);
    doc.line(margin.left, pageHeight - margin.bottom - 5, rightX, pageHeight - margin.bottom - 5);
    doc.setFont(undefined, 'italic'); doc.setFontSize(9); doc.setTextColor(120);
    doc.text(THANK_YOU_LINE2, pageWidth / 2, pageHeight - margin.bottom, { align: 'center' });

    return doc;
};

export const downloadInvoice = async (order) => {
    const doc = await generateInvoice(order);
    const idShort = String(order?.id || '').slice(0, 8).toUpperCase();
    doc.save(`Invoice_${idShort}.pdf`);
};

export const printInvoice = async (order) => {
    const doc = await generateInvoice(order);
    doc.autoPrint();
    const url = doc.output('bloburl');
    window.open(url, '_blank');
};
