import {
  addItemSchema,
  updateItemSchema,
  checkoutSchema,
} from "../validators/cart.schema.js";
import * as svc from "../services/cart.service.js";

export async function get(req, res, next) {
  try {
    res.json(await svc.getCart(req.user.id));
  } catch (e) {
    next(e);
  }
}

export async function addItem(req, res, next) {
  try {
    const data = addItemSchema.parse(req.body);
    res.json(await svc.addItem(req.user.id, data));
  } catch (e) {
    next(e);
  }
}

export async function updateItem(req, res, next) {
  try {
    const { qty } = updateItemSchema.parse(req.body);
    res.json(await svc.updateItem(req.user.id, req.params.dishId, qty));
  } catch (e) {
    next(e);
  }
}

export async function removeItem(req, res, next) {
  try {
    res.json(await svc.removeItem(req.user.id, req.params.dishId));
  } catch (e) {
    next(e);
  }
}

export async function clear(req, res, next) {
  try {
    res.json(await svc.clearCart(req.user.id));
  } catch (e) {
    next(e);
  }
}

export async function checkout(req, res, next) {
  try {
    const data = checkoutSchema.parse(req.body);
    const order = await svc.checkout(req.user, data);
    res.status(201).json(order);
  } catch (e) {
    next(e);
  }
}
