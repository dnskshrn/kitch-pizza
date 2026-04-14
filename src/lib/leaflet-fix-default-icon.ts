import type L from "leaflet"

/** Leaflet в бандле Next не подхватывает пути к дефолтной иконке маркера. */
export function fixLeafletDefaultIcon(Lmod: typeof L) {
  delete (
    Lmod.Icon.Default.prototype as unknown as { _getIconUrl?: unknown }
  )._getIconUrl
  Lmod.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}
