// RFC-0002: Ordering API service implementing menu CRUD, recommendations, and image candidates.
const http = require('http');
const { URL } = require('url');
const { withClient, withTransaction } = require('./db');
const { buildRecommendation } = require('./recommendation');

const port = Number(process.env.API_PORT || 3001);
const corsOrigin = process.env.API_CORS_ORIGIN || 'http://localhost:3000';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, statusCode, message, details) {
  sendJson(response, statusCode, {
    error: message,
    details,
  });
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

function getQuery(url) {
  return Object.fromEntries(url.searchParams.entries());
}

function getPagination(query) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.page_size || query.pageSize || '20', 10) || 20));
  return {
    page,
    page_size: pageSize,
    offset: (page - 1) * pageSize,
    limit: pageSize,
  };
}

function normalizeStatus(status) {
  if (!status) return undefined;
  if (!['draft', 'active', 'inactive'].includes(status)) {
    throw new Error('status must be one of draft, active, inactive.');
  }
  return status;
}

function normalizeImageSource(source) {
  const normalized = source || 'manual';
  if (!['manual', 'ocr', 'vision'].includes(normalized)) {
    const error = new Error('source must be one of manual, ocr, vision.');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function normalizeMenuPayload(payload, options = {}) {
  const errors = [];
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const allowPartial = Boolean(options.allowPartial);

  if (!allowPartial && !name) errors.push('name is required.');
  if (!allowPartial && (!Number.isInteger(payload.price_cents) || payload.price_cents < 0)) {
    errors.push('price_cents must be a non-negative integer.');
  }
  if (payload.price_cents !== undefined && (!Number.isInteger(payload.price_cents) || payload.price_cents < 0)) {
    errors.push('price_cents must be a non-negative integer.');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    description: typeof payload.description === 'string' ? payload.description : null,
    price_cents: payload.price_cents,
    category: typeof payload.category === 'string' ? payload.category : null,
    status: normalizeStatus(payload.status) || 'active',
    image_url: typeof payload.image_url === 'string' ? payload.image_url : null,
    attributes: payload.attributes && typeof payload.attributes === 'object' ? payload.attributes : {},
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients.map(String) : [],
  };
}

function normalizeCandidatePayload(payload) {
  const errors = [];
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name) errors.push('name is required.');
  if (payload.price_cents !== undefined && (!Number.isInteger(payload.price_cents) || payload.price_cents < 0)) {
    errors.push('price_cents must be a non-negative integer when provided.');
  }
  if (payload.confidence !== undefined && (!Number.isFinite(payload.confidence) || payload.confidence < 0 || payload.confidence > 1)) {
    errors.push('confidence must be between 0 and 1 when provided.');
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(' '));
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    description: typeof payload.description === 'string' ? payload.description : null,
    price_cents: typeof payload.price_cents === 'number' ? payload.price_cents : null,
    attributes: payload.attributes && typeof payload.attributes === 'object' ? payload.attributes : {},
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients.map(String) : [],
  };
}

function parseAttributes(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

async function ensureTag(client, tagName, tagType = 'general') {
  const trimmed = tagName.trim();
  if (!trimmed) return null;

  const existing = await client.query('SELECT id FROM tags WHERE name = $1', [trimmed]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await client.query(
    'INSERT INTO tags (name, type) VALUES ($1, $2) RETURNING id',
    [trimmed, tagType]
  );
  return inserted.rows[0].id;
}

async function syncMenuTags(client, menuItemId, tags) {
  await client.query('DELETE FROM menu_item_tags WHERE menu_item_id = $1', [menuItemId]);

  const seen = new Set();
  for (const tag of tags) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    const tagId = await ensureTag(client, tag);
    if (!tagId) continue;
    await client.query('INSERT INTO menu_item_tags (menu_item_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [menuItemId, tagId]);
  }
}

async function syncIngredients(client, menuItemId, ingredients) {
  await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [menuItemId]);

  const seen = new Set();
  for (const ingredient of ingredients) {
    if (!ingredient || seen.has(ingredient)) continue;
    seen.add(ingredient);
    await client.query(
      'INSERT INTO menu_item_ingredients (menu_item_id, ingredient, confidence) VALUES ($1, $2, 1.00) ON CONFLICT (menu_item_id, ingredient) DO UPDATE SET confidence = 1.00',
      [menuItemId, ingredient]
    );
  }
}

async function createMenuItem(client, payload) {
  const result = await client.query(
    `INSERT INTO menu_items (name, description, price_cents, category, status, image_url, attributes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at`,
    [payload.name, payload.description, payload.price_cents, payload.category, payload.status, payload.image_url, JSON.stringify(payload.attributes)]
  );
  return result.rows[0];
}

async function updateMenuItem(client, menuItemId, payload) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(payload)) {
    if (['name', 'description', 'price_cents', 'category', 'status', 'image_url', 'attributes'].includes(key)) {
      values.push(key === 'attributes' ? JSON.stringify(value) : value);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (fields.length === 0) {
    const current = await client.query(
      'SELECT id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at FROM menu_items WHERE id = $1',
      [menuItemId]
    );
    return current.rows[0];
  }

  values.push(menuItemId);
  const result = await client.query(
    `UPDATE menu_items
     SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${values.length}
     RETURNING id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at`,
    values
  );
  return result.rows[0];
}

async function enrichMenuItem(client, item) {
  if (!item) return item;
  const tags = await client.query(
    `SELECT t.name, t.type
     FROM menu_item_tags mit
     JOIN tags t ON t.id = mit.tag_id
     WHERE mit.menu_item_id = $1
     ORDER BY t.name`,
    [item.id]
  );
  const ingredients = await client.query(
    'SELECT ingredient, confidence FROM menu_item_ingredients WHERE menu_item_id = $1 ORDER BY ingredient',
    [item.id]
  );

  return {
    ...item,
    attributes: parseAttributes(item.attributes),
    tags: tags.rows.map((tag) => tag.name),
    ingredients: ingredients.rows.map((ingredient) => ingredient.ingredient),
  };
}

async function fetchActiveMenuItems(client) {
  const result = await client.query(
    `SELECT id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at
     FROM menu_items
     WHERE status = 'active'
     ORDER BY price_cents ASC, name ASC`
  );

  const items = [];
  for (const item of result.rows) {
    items.push(await enrichMenuItem(client, item));
  }
  return items;
}

async function handleMenuItems(request, response, url, method) {
  if (method === 'GET' && url.pathname === '/api/menu-items') {
    const query = getQuery(url);
    const { page, page_size, offset, limit } = getPagination(query);
    const filters = [];
    const values = [];

    if (query.keyword) {
      values.push(`%${query.keyword}%`);
      filters.push(`name ILIKE $${values.length} OR description ILIKE $${values.length}`);
    }
    if (query.category) {
      values.push(query.category);
      filters.push(`category = $${values.length}`);
    }
    try {
      const status = normalizeStatus(query.status);
      if (status) {
        values.push(status);
        filters.push(`status = $${values.length}`);
      }
    } catch (error) {
      sendError(response, 400, error.message);
      return;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    values.push(limit, offset);

    const [itemsResult, countResult] = await withClient(async (client) => {
      const items = await client.query(
        `SELECT id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at
         FROM menu_items
         ${whereClause}
         ORDER BY created_at DESC, name ASC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      const count = await client.query(`SELECT COUNT(*)::int AS count FROM menu_items ${whereClause}`, values.slice(0, -2));
      return [items, count];
    });

    const enrichedItems = await withClient(async (client) => Promise.all(itemsResult.rows.map((item) => enrichMenuItem(client, item))));

    sendJson(response, 200, {
      page,
      page_size,
      total: countResult.rows[0].count,
      items: enrichedItems,
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/menu-items') {
    try {
      const payload = normalizeMenuPayload(await parseJsonBody(request));
      const item = await withTransaction(async (client) => {
        const created = await createMenuItem(client, payload);
        await syncMenuTags(client, created.id, payload.tags);
        await syncIngredients(client, created.id, payload.ingredients);
        return enrichMenuItem(client, created);
      });
      sendJson(response, 201, item);
    } catch (error) {
      sendError(response, error.statusCode || 500, error.message);
    }
    return;
  }

  sendError(response, 404, 'Not found.');
}

async function handleMenuItemById(request, response, id, method) {
  if (method === 'GET') {
    const item = await withClient(async (client) => {
      const result = await client.query(
        'SELECT id, name, description, price_cents, category, status, image_url, attributes, created_at, updated_at FROM menu_items WHERE id = $1',
        [id]
      );
      return enrichMenuItem(client, result.rows[0]);
    });

    if (!item) {
      sendError(response, 404, 'Menu item not found.');
      return;
    }
    sendJson(response, 200, item);
    return;
  }

  if (method === 'PATCH') {
    let body;
    try {
      body = await parseJsonBody(request);
    } catch (error) {
      sendError(response, 400, error.message);
      return;
    }

    try {
      const allowedFields = {
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        description: typeof body.description === 'string' ? body.description : undefined,
        price_cents: Number.isInteger(body.price_cents) ? body.price_cents : undefined,
        category: typeof body.category === 'string' ? body.category : undefined,
        status: normalizeStatus(body.status),
        image_url: typeof body.image_url === 'string' ? body.image_url : undefined,
        attributes: body.attributes && typeof body.attributes === 'object' ? body.attributes : undefined,
      };
      const updatePayload = Object.fromEntries(Object.entries(allowedFields).filter(([, value]) => value !== undefined));

      if (updatePayload.name === '') {
        sendError(response, 400, 'name cannot be empty.');
        return;
      }
      if (updatePayload.price_cents !== undefined && updatePayload.price_cents < 0) {
        sendError(response, 400, 'price_cents must be a non-negative integer.');
        return;
      }
      if (Object.keys(updatePayload).length === 0) {
        sendError(response, 400, 'No update fields provided.');
        return;
      }

      const item = await withTransaction(async (client) => {
        const existing = await client.query('SELECT id FROM menu_items WHERE id = $1', [id]);
        if (existing.rows.length === 0) return null;
        const updated = await updateMenuItem(client, id, updatePayload);
        if (Array.isArray(body.tags)) await syncMenuTags(client, id, body.tags.map(String));
        if (Array.isArray(body.ingredients)) await syncIngredients(client, id, body.ingredients.map(String));
        return enrichMenuItem(client, updated);
      });

      if (!item) {
        sendError(response, 404, 'Menu item not found.');
        return;
      }
      sendJson(response, 200, item);
    } catch (error) {
      sendError(response, error.statusCode || 500, error.message);
    }
    return;
  }

  if (method === 'DELETE') {
    const result = await withClient(async (client) => {
      const deleted = await client.query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [id]);
      return deleted.rows[0];
    });
    if (!result) {
      sendError(response, 404, 'Menu item not found.');
      return;
    }
    sendJson(response, 200, { id: result.id, deleted: true });
    return;
  }

  sendError(response, 404, 'Not found.');
}

function normalizeRecommendationRequest(body) {
  const hasTopLevelConstraints = Object.prototype.hasOwnProperty.call(body, 'allergies')
    || Object.prototype.hasOwnProperty.call(body, 'dislikes')
    || Object.prototype.hasOwnProperty.call(body, 'spicy_tolerance')
    || Object.prototype.hasOwnProperty.call(body, 'spicyTolerance');

  const memberConstraints = Array.isArray(body.member_constraints)
    ? body.member_constraints
    : [];

  if (hasTopLevelConstraints) {
    memberConstraints.push({
      member_id: 'request',
      allergies: Array.isArray(body.allergies) ? body.allergies.map(String) : [],
      dislikes: Array.isArray(body.dislikes) ? body.dislikes.map(String) : [],
      spicy_tolerance: Object.prototype.hasOwnProperty.call(body, 'spicy_tolerance') ? body.spicy_tolerance : body.spicyTolerance,
    });
  }

  return {
    ...body,
    budget_cents: body.budget_cents !== undefined ? body.budget_cents : body.budget,
    person_count: body.person_count !== undefined ? body.person_count : body.people,
    member_constraints: memberConstraints,
  };
}

async function handleRecommendations(request, response, url, method) {
  if (method === 'POST' && url.pathname === '/api/recommendations') {
    const body = normalizeRecommendationRequest(await parseJsonBody(request));
    const budgetCents = Number(body.budget_cents);
    const personCount = Number(body.person_count);
    if (!Number.isFinite(budgetCents) || budgetCents <= 0) {
      sendError(response, 400, 'budget_cents must be greater than 0.');
      return;
    }
    if (!Number.isInteger(personCount) || personCount <= 0) {
      sendError(response, 400, 'person_count must be a positive integer.');
      return;
    }

    const recommendation = await withClient(async (client) => {
      const activeItems = await fetchActiveMenuItems(client);
      return buildRecommendation(body, activeItems);
    });

    const session = await withTransaction(async (client) => {
      const insertedSession = await client.query(
        `INSERT INTO recommendation_sessions (budget_cents, person_count, member_constraints, status, result_summary)
         VALUES ($1, $2, $3, 'running', $4)
         RETURNING id, budget_cents, person_count, member_constraints, status, result_summary, created_at`,
        [budgetCents, personCount, JSON.stringify(body.member_constraints || []), JSON.stringify({
          total_price_cents: recommendation.total_price_cents,
          item_count: recommendation.items.length,
          reasons: recommendation.reasons,
        })]
      );
      const sessionId = insertedSession.rows[0].id;

      for (const item of recommendation.items) {
        await client.query(
          `INSERT INTO recommendation_items (session_id, menu_item_id, quantity, unit_price_cents, subtotal_cents)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (session_id, menu_item_id) DO UPDATE
           SET quantity = EXCLUDED.quantity, unit_price_cents = EXCLUDED.unit_price_cents, subtotal_cents = EXCLUDED.subtotal_cents`,
          [sessionId, item.menu_item_id, item.quantity, item.unit_price_cents, item.subtotal_cents]
        );
      }

      await client.query("UPDATE recommendation_sessions SET status = 'completed' WHERE id = $1", [sessionId]);
      return insertedSession.rows[0];
    });

    sendJson(response, 201, {
      session_id: session.id,
      total_price_cents: recommendation.total_price_cents,
      items: recommendation.items,
      reasons: recommendation.reasons,
      conflicts: recommendation.conflicts,
    });
    return;
  }

  if (method === 'GET') {
    const match = url.pathname.match(/^\/api\/recommendations\/([^/]+)$/);
    if (!match) {
      sendError(response, 404, 'Not found.');
      return;
    }
    const sessionId = match[1];
    const result = await withClient(async (client) => {
      const session = await client.query(
        `SELECT id, budget_cents, person_count, member_constraints, status, result_summary, created_at
         FROM recommendation_sessions WHERE id = $1`,
        [sessionId]
      );
      if (session.rows.length === 0) return null;

      const items = await client.query(
        `SELECT ri.menu_item_id, mi.name, ri.quantity, ri.unit_price_cents, ri.subtotal_cents
         FROM recommendation_items ri
         JOIN menu_items mi ON mi.id = ri.menu_item_id
         WHERE ri.session_id = $1
         ORDER BY mi.name`,
        [sessionId]
      );

      return {
        ...session.rows[0],
        items: items.rows,
      };
    });

    if (!result) {
      sendError(response, 404, 'Recommendation session not found.');
      return;
    }

    const resultSummary = parseAttributes(result.result_summary);

    sendJson(response, 200, {
      session_id: result.id,
      total_price_cents: result.items.reduce((sum, item) => sum + item.subtotal_cents, 0),
      items: result.items,
      reasons: Array.isArray(resultSummary.reasons) ? resultSummary.reasons : [],
      status: result.status,
    });
    return;
  }

  sendError(response, 404, 'Not found.');
}

async function handleMenuImages(request, response, url, method) {
  if (method === 'POST' && url.pathname === '/api/menu-images') {
    const body = await parseJsonBody(request);
    const errors = [];
    if (typeof body.file_name !== 'string' || !body.file_name.trim()) errors.push('file_name is required.');
    if (typeof body.storage_path !== 'string' || !body.storage_path.trim()) errors.push('storage_path is required.');
    if (typeof body.mime_type !== 'string' || !body.mime_type.trim()) errors.push('mime_type is required.');
    if (errors.length > 0) {
      sendError(response, 400, errors.join(' '));
      return;
    }

    const image = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO menu_images (file_name, storage_path, mime_type, source, status, raw_response)
         VALUES ($1, $2, $3, $4, 'pending', $5)
         RETURNING id, file_name, storage_path, mime_type, source, status, raw_response, created_at`,
        [body.file_name, body.storage_path, body.mime_type, normalizeImageSource(body.source), JSON.stringify(body.raw_response || {})]
      );
      return result.rows[0];
    });

    sendJson(response, 201, image);
    return;
  }

  sendError(response, 404, 'Not found.');
}

function candidateAttributes(candidate) {
  const attributes = candidate.attributes && typeof candidate.attributes === 'object' ? { ...candidate.attributes } : {};
  if (Array.isArray(candidate.tags) && candidate.tags.length > 0) attributes.tags = candidate.tags;
  if (Array.isArray(candidate.ingredients) && candidate.ingredients.length > 0) attributes.ingredients = candidate.ingredients;
  return attributes;
}

async function handleMenuImageRecognition(request, response, id, method) {
  if (method !== 'POST') {
    sendError(response, 404, 'Not found.');
    return;
  }

  const body = await parseJsonBody(request);
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const image = await withTransaction(async (client) => {
    const existing = await client.query('SELECT id FROM menu_images WHERE id = $1', [id]);
    if (existing.rows.length === 0) return null;

    const recognizedCandidates = candidates.map((candidate) => {
      const normalized = normalizeCandidatePayload(candidate);
      return {
        ...normalized,
        confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 1.0,
      };
    });

    await client.query(
      `UPDATE menu_images
       SET status = 'processed', raw_response = $2
       WHERE id = $1`,
      [id, JSON.stringify(body.recognition || { candidates: recognizedCandidates })]
    );

    for (const candidate of recognizedCandidates) {
      const result = await client.query(
        `INSERT INTO menu_item_candidates (source_image_id, name, description, price_cents, attributes, confidence, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, source_image_id, name, description, price_cents, attributes, confidence, status, created_at`,
        [id, candidate.name, candidate.description, candidate.price_cents, JSON.stringify(candidateAttributes(candidate)), candidate.confidence]
      );
      result.rows[0].tags = candidate.tags;
      result.rows[0].ingredients = candidate.ingredients;
    }

    return existing.rows[0];
  });

  if (!image) {
    sendError(response, 404, 'Menu image not found.');
    return;
  }

  sendJson(response, 200, { image_id: id, status: 'processed', candidate_count: candidates.length });
}

async function handleCandidateConfirmation(request, response, method) {
  if (method !== 'POST' || request.url !== '/api/menu-items/from-candidates') {
    sendError(response, 404, 'Not found.');
    return;
  }

  const body = await parseJsonBody(request);
  const candidateIds = Array.isArray(body.candidate_ids) ? body.candidate_ids : [];
  if (candidateIds.length === 0) {
    sendError(response, 400, 'candidate_ids is required.');
    return;
  }

  const createdItems = await withTransaction(async (client) => {
    const items = [];
    for (const candidateId of candidateIds) {
      const candidate = await client.query(
        `SELECT id, name, description, price_cents, attributes, confidence, status
         FROM menu_item_candidates WHERE id = $1`,
        [candidateId]
      );
      if (candidate.rows.length === 0) continue;
      const row = candidate.rows[0];
      if (row.status !== 'pending') continue;

      const attributes = parseAttributes(row.attributes);
      const tags = Array.isArray(attributes.tags) ? attributes.tags.map(String) : [];
      const ingredients = Array.isArray(attributes.ingredients) ? attributes.ingredients.map(String) : [];
      delete attributes.tags;
      delete attributes.ingredients;

      const created = await createMenuItem(client, {
        name: row.name,
        description: row.description,
        price_cents: row.price_cents || 0,
        category: attributes.category || null,
        status: 'active',
        image_url: null,
        attributes,
        tags,
        ingredients,
      });
      await syncMenuTags(client, created.id, tags);
      await syncIngredients(client, created.id, ingredients);
      await client.query('UPDATE menu_item_candidates SET status = $1 WHERE id = $2', ['accepted', candidateId]);
      items.push(await enrichMenuItem(client, created));
    }
    return items;
  });

  sendJson(response, 201, { accepted_count: createdItems.length, items: createdItems });
}

async function routeRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (url.pathname === '/api/menu-items') {
      await handleMenuItems(request, response, url, method);
      return;
    }

    if (url.pathname === '/api/menu-items/from-candidates') {
      await handleCandidateConfirmation(request, response, method);
      return;
    }

    const menuItemMatch = url.pathname.match(/^\/api\/menu-items\/([^/]+)$/);
    if (menuItemMatch) {
      await handleMenuItemById(request, response, menuItemMatch[1], method);
      return;
    }

    if (url.pathname === '/api/recommendations') {
      await handleRecommendations(request, response, url, method);
      return;
    }

    const recommendationMatch = url.pathname.match(/^\/api\/recommendations\/([^/]+)$/);
    if (recommendationMatch) {
      await handleRecommendations(request, response, url, method);
      return;
    }

    if (url.pathname === '/api/menu-images') {
      await handleMenuImages(request, response, url, method);
      return;
    }

    const menuImageRecognitionMatch = url.pathname.match(/^\/api\/menu-images\/([^/]+)\/recognize$/);
    if (menuImageRecognitionMatch) {
      await handleMenuImageRecognition(request, response, menuImageRecognitionMatch[1], method);
      return;
    }

    if (url.pathname === '/') {
      sendJson(response, 200, {
        service: 'ordering-api',
        status: 'ok',
        rfc: 'RFC-0002',
        endpoints: [
          'GET /api/menu-items',
          'POST /api/menu-items',
          'GET /api/menu-items/:id',
          'PATCH /api/menu-items/:id',
          'DELETE /api/menu-items/:id',
          'POST /api/recommendations',
          'GET /api/recommendations/:id',
          'POST /api/menu-images',
          'POST /api/menu-images/:id/recognize',
          'POST /api/menu-items/from-candidates',
        ],
      });
      return;
    }

    sendError(response, 404, 'Not found.');
  } catch (error) {
    sendError(response, error.statusCode || 500, error.message);
  }
}

const server = http.createServer(routeRequest);

if (require.main === module) {
  server.listen(port, () => {
    console.log(`ordering-api listening on ${port}`);
  });
}

module.exports = {
  server,
  routeRequest,
  buildRecommendation,
};
