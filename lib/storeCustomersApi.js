export function isValidCustomerImage(image) {
  const value = String(image || '').trim();
  if (!value) return false;
  if (value === '/placeholder.png' || value === '/placeholder-avatar.png') return false;
  return /^(https?:)?\/\//i.test(value) || value.startsWith('/');
}

export function resolveCustomerFromOrder(order) {
  if (order.isGuest) {
    return {
      customerId: `guest-${order.guestEmail || order._id}`,
      name: order.guestName || order.shippingAddress?.name || 'Guest Customer',
      email: order.guestEmail || order.shippingAddress?.email || 'No email',
      image: null,
      isGuest: true,
    };
  }

  if (order.userId && typeof order.userId === 'object' && order.userId._id) {
    return {
      customerId: order.userId._id.toString(),
      name: order.userId.name || order.shippingAddress?.name || 'Customer',
      email: order.userId.email || order.shippingAddress?.email || 'No email',
      image: order.userId.image || null,
      isGuest: false,
    };
  }

  if (order.userId) {
    return {
      customerId: order.userId.toString(),
      name: order.guestName || order.shippingAddress?.name || 'Customer',
      email: order.guestEmail || order.shippingAddress?.email || 'No email',
      image: null,
      isGuest: false,
    };
  }

  return {
    customerId: `unknown-${order._id}`,
    name: order.guestName || order.shippingAddress?.name || 'Guest Customer',
    email: order.guestEmail || order.shippingAddress?.email || 'No email',
    image: null,
    isGuest: true,
  };
}

export function buildCustomerSummaries(orders, registeredUsers = []) {
  const customerMap = new Map();

  for (const order of orders) {
    const { customerId, name, email, image, isGuest } = resolveCustomerFromOrder(order);

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        _id: customerId,
        id: customerId,
        name,
        email,
        image,
        isGuest,
        totalOrders: 0,
        totalSpent: 0,
        firstOrderDate: order.createdAt,
        lastOrderDate: order.createdAt,
        latestOrder: null,
      });
    }

    const customer = customerMap.get(customerId);
    customer.totalOrders += 1;
    customer.totalSpent += Number(order.total || 0);

    if (!isGuest && isValidCustomerImage(image)) {
      customer.image = image;
    }

    if (new Date(order.createdAt) < new Date(customer.firstOrderDate)) {
      customer.firstOrderDate = order.createdAt;
    }

    if (new Date(order.createdAt) >= new Date(customer.lastOrderDate)) {
      customer.lastOrderDate = order.createdAt;
      customer.latestOrder = {
        id: order._id.toString(),
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
      };
    }
  }

  for (const user of registeredUsers) {
    const userId = user._id.toString();

    if (customerMap.has(userId)) {
      const customer = customerMap.get(userId);
      customer.isGuest = false;
      customer.name = user.name || customer.name;
      customer.email = user.email || customer.email;
      if (isValidCustomerImage(user.image)) {
        customer.image = user.image;
      }
      continue;
    }

    customerMap.set(userId, {
      _id: userId,
      id: userId,
      name: user.name || 'User',
      email: user.email,
      image: user.image,
      isGuest: false,
      totalOrders: 0,
      totalSpent: 0,
      firstOrderDate: user.createdAt,
      lastOrderDate: user.createdAt,
      latestOrder: null,
    });
  }

  return Array.from(customerMap.values()).sort((left, right) => right.totalSpent - left.totalSpent);
}

export function enrichCustomersWithUsers(customers, users = []) {
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return customers.map((customer) => {
    if (customer.isGuest) return customer;

    const user = userMap.get(String(customer.id));
    if (!user) return customer;

    return {
      ...customer,
      name: user.name || customer.name,
      email: user.email || customer.email,
      image: isValidCustomerImage(user.image) ? user.image : customer.image,
      isGuest: false,
    };
  });
}

export function filterCustomers(customers, { search = '', view = 'all' } = {}) {
  const query = String(search || '').trim().toLowerCase();

  return customers.filter((customer) => {
    const matchesSearch = !query
      || customer.name?.toLowerCase().includes(query)
      || customer.email?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (view === 'registered') {
      return Boolean(customer.email) && !customer.isGuest;
    }

    return true;
  });
}

export function paginateCustomers(customers, page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const total = customers.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safeLimit;

  return {
    customers: customers.slice(start, start + safeLimit),
    pagination: {
      page: currentPage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

function buildCustomerGroupStages() {
  return [
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        customerKey: {
          $cond: [
            { $eq: ['$isGuest', true] },
            {
              $concat: [
                'guest-',
                {
                  $ifNull: [
                    '$guestEmail',
                    { $ifNull: ['$shippingAddress.email', { $toString: '$_id' }] },
                  ],
                },
              ],
            },
            { $toString: '$userId' },
          ],
        },
        guestDisplayName: {
          $ifNull: ['$guestName', { $ifNull: ['$shippingAddress.name', 'Guest Customer'] }],
        },
        guestDisplayEmail: {
          $ifNull: ['$guestEmail', { $ifNull: ['$shippingAddress.email', 'No email'] }],
        },
      },
    },
    {
      $group: {
        _id: '$customerKey',
        id: { $first: '$customerKey' },
        userId: {
          $first: {
            $cond: [{ $eq: ['$isGuest', true] }, null, '$userId'],
          },
        },
        name: {
          $first: {
            $cond: [{ $eq: ['$isGuest', true] }, '$guestDisplayName', null],
          },
        },
        email: {
          $first: {
            $cond: [{ $eq: ['$isGuest', true] }, '$guestDisplayEmail', null],
          },
        },
        isGuest: { $first: { $ifNull: ['$isGuest', false] } },
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: { $ifNull: ['$total', 0] } },
        firstOrderDate: { $min: '$createdAt' },
        lastOrderDate: { $max: '$createdAt' },
        latestOrder: {
          $first: {
            id: { $toString: '$_id' },
            total: '$total',
            status: '$status',
            createdAt: '$createdAt',
          },
        },
        latestPhone: {
          $first: {
            $ifNull: [
              '$alternatePhone',
              { $ifNull: ['$shippingAddress.phone', '$guestPhone'] },
            ],
          },
        },
        latestPhoneCode: { $first: '$shippingAddress.phoneCode' },
        latestStreet: { $first: '$shippingAddress.street' },
        latestDistrict: { $first: '$shippingAddress.district' },
        latestCity: { $first: '$shippingAddress.city' },
        latestState: { $first: '$shippingAddress.state' },
        latestCountry: { $first: '$shippingAddress.country' },
      },
    },
  ];
}

export async function aggregateStoreCustomers(Order, storeId, {
  search = '',
  view = 'all',
  page = 1,
  limit = 20,
  matchingUserIds = [],
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;
  const filterStages = buildCustomerFilterStages({ search, view, matchingUserIds });

  const [result] = await Order.aggregate([
    { $match: { storeId: String(storeId) } },
    ...buildCustomerGroupStages(),
    {
      $facet: {
        globalStats: [
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              registeredCount: {
                $sum: { $cond: [{ $eq: ['$isGuest', false] }, 1, 0] },
              },
            },
          },
        ],
        filteredTotal: [
          ...filterStages,
          { $count: 'count' },
        ],
        filteredPage: [
          ...filterStages,
          { $sort: { totalSpent: -1 } },
          { $skip: skip },
          { $limit: safeLimit },
        ],
      },
    },
  ]);

  const globalStats = result?.globalStats?.[0] || { totalCustomers: 0, registeredCount: 0 };
  const filteredTotal = result?.filteredTotal?.[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / safeLimit));
  const currentPage = Math.min(safePage, totalPages);

  return {
    customers: result?.filteredPage || [],
    pagination: {
      page: currentPage,
      limit: safeLimit,
      total: filteredTotal,
      totalPages,
    },
    stats: {
      totalCustomers: globalStats.totalCustomers || 0,
      registeredCount: globalStats.registeredCount || 0,
      filteredTotal,
    },
  };
}

function buildCustomerFilterStages({ search = '', view = 'all', matchingUserIds = [] } = {}) {
  const filterStages = [];
  const query = String(search || '').trim();

  if (view === 'registered') {
    filterStages.push({ $match: { isGuest: false } });
  }

  if (query) {
    const searchRegex = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const userIdStrings = matchingUserIds.map((id) => String(id));

    filterStages.push({
      $match: {
        ...(view === 'registered' ? { isGuest: false } : {}),
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          ...(userIdStrings.length ? [{ userId: { $in: userIdStrings } }] : []),
        ],
      },
    });
  }

  return filterStages;
}

export async function aggregateAllStoreCustomers(Order, storeId, {
  search = '',
  view = 'all',
  matchingUserIds = [],
} = {}) {
  const filterStages = buildCustomerFilterStages({ search, view, matchingUserIds });

  return Order.aggregate([
    { $match: { storeId: String(storeId) } },
    ...buildCustomerGroupStages(),
    ...filterStages,
    { $sort: { totalSpent: -1 } },
  ]);
}
