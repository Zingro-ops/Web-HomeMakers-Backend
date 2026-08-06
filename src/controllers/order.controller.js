import {
  createOrderSchema,
  updateOrderStatusSchema,
  listOrdersSchema,
} from "../validators/order.schema.js";
import * as svc from "../services/order.service.js";

export async function create(req, res, next) {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await svc.createOrder(req.user, data);
    res.status(201).json(order);
  } catch (e) {
    next(e);
  }
}

export async function mine(req, res, next) {
  try {
    const q = listOrdersSchema.parse(req.query);
    res.json(await svc.listCustomerOrders(req.user.id, q));
  } catch (e) {
    next(e);
  }
}

export async function cookList(req, res, next) {
  try {
    const q = listOrdersSchema.parse(req.query);
    res.json(await svc.listCookOrders(req.cookId, q));
  } catch (e) {
    next(e);
  }
}

export async function cookUpdateStatus(req, res, next) {
  try {
    const { status, readyPhoto } = updateOrderStatusSchema.parse(req.body);
    res.json(await svc.updateOrderStatus(req.cookId, req.params.id, status, readyPhoto));
  } catch (e) {
    next(e);
  }
}


export async function getOne(req, res, next) {
  try {
    res.json(await svc.getById(req.user.id, req.params.id));
  } catch (e) { next(e); }
}

export async function cancel(req, res, next) {
  try {
    res.json(await svc.cancelOrder(req.user.id, req.params.id));
  } catch (e) { next(e); }
}

export async function reorder(req, res, next) {
  try {
    res.json(await svc.reorder(req.user.id, req.params.id));
  } catch (e) { next(e); }
}
