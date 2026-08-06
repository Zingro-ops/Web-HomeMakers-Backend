import { Cart } from "../models/Cart.js";
import { Dish } from "../models/Dish.js";
import { Cook } from "../models/Cook.js";
import Address from "../models/Address.js";
import * as couponSvc from "./coupon.service.js";
import { RATES, calcDeliveryFee } from "../config/checkoutRates.js";
import { distanceMeters } from "../utils/geo.js"; // existing file â€” reused as-is

const round2 = (n) => Math.round(n * 100) / 100;
const toLatLng = ([lng, lat]) => ({ lat, lng }); // GeoJSON [lng,lat] -> {lat,lng}

export async function computeBreakdown({ userId, addressId, couponCode }) {
  const cart = await Cart.findOne({ customerId: userId });
  if (!cart || !cart.items?.length)
    throw Object.assign(new Error("Cart is empty"), {
      status: 400,
      code: "CART_EMPTY",
    });

  const cook = await Cook.findById(cart.cookId);
  if (!cook)
    throw Object.assign(new Error("Kitchen not found"), { status: 404 });

  const address = await Address.findOne({ _id: addressId, userId });
  if (!address)
    throw Object.assign(new Error("Address not found"), {
      status: 404,
      code: "ADDRESS_NOT_FOUND",
    });

  const dishIds = cart.items.map((i) => i.dishId);
  const dishes = await Dish.find({ _id: { $in: dishIds } });
  const dishMap = new Map(dishes.map((d) => [String(d._id), d]));

  let subtotal = 0;
  const lineItems = [];
  for (const item of cart.items) {
    const dish = dishMap.get(String(item.dishId));
    if (!dish)
      throw Object.assign(
        new Error("A dish in your cart is no longer available"),
        { status: 409, code: "DISH_UNAVAILABLE" },
      );
    if (!dish.available)
      throw Object.assign(new Error(`${dish.name} is currently out of stock`), {
        status: 409,
        code: "DISH_OUT_OF_STOCK",
      });
    const lineTotal = dish.price * item.qty;
    subtotal += lineTotal;
    lineItems.push({
      dishId: dish._id,
      name: dish.name,
      price: dish.price,
      qty: item.qty,
      lineTotal,
    });
  }
  subtotal = round2(subtotal);

  const gst = round2((subtotal * RATES.GST_PERCENT) / 100);
  const packingFee = round2((subtotal * RATES.PACKING_PERCENT) / 100);
  const platformFee = round2((subtotal * RATES.PLATFORM_PERCENT) / 100);

  const meters = distanceMeters(
    toLatLng(cook.location.coordinates),
    toLatLng(address.location.coordinates),
  );
  const km = meters / 1000;
  const deliveryFee = calcDeliveryFee(km);

  let couponDiscount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const { coupon, discount } = await couponSvc.validate({
      code: couponCode,
      userId,
      cookId: cook._id,
      orderValue: subtotal,
    });
    couponDiscount = discount;
    appliedCoupon = { code: coupon.code, couponId: coupon._id };
  }

  const walletDiscount = 0;

  const grandTotal = round2(
    subtotal +
      gst +
      packingFee +
      platformFee +
      deliveryFee -
      couponDiscount -
      walletDiscount,
  );

  return {
    lineItems,
    subtotal,
    gst,
    packingFee,
    platformFee,
    deliveryFee,
    deliveryDistanceKm: round2(km),
    couponDiscount,
    appliedCoupon,
    walletDiscount,
    grandTotal,
  };
}

