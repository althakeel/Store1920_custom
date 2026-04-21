import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Store from "@/models/Store";
import { getAuth } from "@/lib/firebase-admin";

const asTrimmedString = (value) => String(value || '').trim()

function normalizeSmtpSection(raw = {}) {
  const portValue = Number(raw?.port)
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 465

  return {
    host: asTrimmedString(raw?.host),
    port,
    user: asTrimmedString(raw?.user),
    pass: asTrimmedString(raw?.pass),
    secure: raw?.secure !== undefined ? Boolean(raw.secure) : port === 465,
    fromEmail: asTrimmedString(raw?.fromEmail),
    fromName: asTrimmedString(raw?.fromName),
  }
}

function normalizeSmtpSettings(raw = {}) {
  const transactionalSource = raw?.transactional && typeof raw.transactional === 'object'
    ? raw.transactional
    : raw
  const promotionalSource = raw?.promotional && typeof raw.promotional === 'object'
    ? raw.promotional
    : raw

  return {
    transactional: normalizeSmtpSection(transactionalSource),
    promotional: normalizeSmtpSection(promotionalSource),
    updatedAt: new Date(),
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    await dbConnect();

    const body = await request.json();
    const {
      name,
      image,
      email,
      storeName,
      storePhone,
      storeWebsite,
      storeAddress,
      storeDescription,
      smtpSettings,
    } = body || {};

    const normalizedEmail = asTrimmedString(email).toLowerCase()
    if (normalizedEmail) {
      const existingByEmail = await User.findOne({ email: normalizedEmail }).lean()
      if (existingByEmail && String(existingByEmail._id) !== String(userId)) {
        return NextResponse.json(
          { error: `Email ${normalizedEmail} is already linked to another account.` },
          { status: 409 }
        )
      }
    }

    await User.findOneAndUpdate(
      { _id: userId },
      {
        _id: userId,
        firebaseUid: userId,
        ...(name !== undefined ? { name: asTrimmedString(name) } : {}),
        ...(image !== undefined ? { image: asTrimmedString(image) } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const existingStore = await Store.findOne({ userId });
    if (existingStore) {
      const updateStoreData = {
        ...(storeName !== undefined ? { name: asTrimmedString(storeName) } : {}),
        ...(storePhone !== undefined ? { contact: asTrimmedString(storePhone) } : {}),
        ...(storeWebsite !== undefined ? { website: asTrimmedString(storeWebsite) } : {}),
        ...(storeAddress !== undefined ? { address: asTrimmedString(storeAddress) } : {}),
        ...(storeDescription !== undefined ? { description: asTrimmedString(storeDescription) } : {}),
      }

      if (smtpSettings && typeof smtpSettings === 'object') {
        updateStoreData.smtpSettings = normalizeSmtpSettings(smtpSettings)
      }

      if (Object.keys(updateStoreData).length > 0) {
        await Store.updateOne({ _id: existingStore._id }, { $set: updateStoreData })
      }
    }

    return NextResponse.json({ message: 'Profile updated' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const userId = decodedToken.uid

    await dbConnect()

    const user = await User.findById(userId).lean()
    const store = await Store.findOne({ userId }).lean()

    return NextResponse.json({
      profile: {
        name: user?.name || '',
        email: user?.email || decodedToken.email || '',
        image: user?.image || '',
      },
      store: {
        storeName: store?.name || '',
        storePhone: store?.contact || '',
        storeWebsite: store?.website || '',
        storeAddress: store?.address || '',
        storeDescription: store?.description || '',
      },
      smtpSettings: {
        transactional: {
          host: store?.smtpSettings?.transactional?.host || store?.smtpSettings?.host || '',
          port: store?.smtpSettings?.transactional?.port || store?.smtpSettings?.port || 465,
          user: store?.smtpSettings?.transactional?.user || store?.smtpSettings?.user || '',
          pass: store?.smtpSettings?.transactional?.pass || store?.smtpSettings?.pass || '',
          secure:
            typeof store?.smtpSettings?.transactional?.secure === 'boolean'
              ? store.smtpSettings.transactional.secure
              : (typeof store?.smtpSettings?.secure === 'boolean' ? store.smtpSettings.secure : true),
          fromEmail: store?.smtpSettings?.transactional?.fromEmail || store?.smtpSettings?.fromEmail || '',
          fromName: store?.smtpSettings?.transactional?.fromName || store?.smtpSettings?.fromName || '',
        },
        promotional: {
          host: store?.smtpSettings?.promotional?.host || store?.smtpSettings?.host || '',
          port: store?.smtpSettings?.promotional?.port || store?.smtpSettings?.port || 465,
          user: store?.smtpSettings?.promotional?.user || store?.smtpSettings?.user || '',
          pass: store?.smtpSettings?.promotional?.pass || store?.smtpSettings?.pass || '',
          secure:
            typeof store?.smtpSettings?.promotional?.secure === 'boolean'
              ? store.smtpSettings.promotional.secure
              : (typeof store?.smtpSettings?.secure === 'boolean' ? store.smtpSettings.secure : true),
          fromEmail: store?.smtpSettings?.promotional?.fromEmail || store?.smtpSettings?.fromEmail || '',
          fromName: store?.smtpSettings?.promotional?.fromName || store?.smtpSettings?.fromName || '',
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
