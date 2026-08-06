const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

export async function geocode({ placeId, address }) {
  if (!GOOGLE_KEY) throw Object.assign(new Error("Geocoding unavailable"), { status: 503 });

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  if (placeId) url.searchParams.set("place_id", placeId);
  else if (address) url.searchParams.set("address", address);
  else throw Object.assign(new Error("placeId or address required"), { status: 400 });
  url.searchParams.set("key", GOOGLE_KEY);

  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "OK" || !j.results?.length)
    throw Object.assign(new Error(`Geocode failed: ${j.status}`), { status: 422 });

  const res = j.results[0];
  const get = (t) => res.address_components.find((c) => c.types.includes(t))?.long_name || "";
  return {
    lat: res.geometry.location.lat,
    lng: res.geometry.location.lng,
    placeId: res.place_id,
    formatted: res.formatted_address,
    components: {
      city: get("locality") || get("administrative_area_level_2"),
      state: get("administrative_area_level_1"),
      pincode: get("postal_code"),
    },
  };
}
