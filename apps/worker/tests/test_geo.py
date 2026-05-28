from app.detection.geo import lat_lng_to_pixel, pixel_bbox_to_lat_lng, pixel_to_lat_lng


def test_pixel_roundtrip_at_zoom19() -> None:
    lat, lng = 51.5310, -0.2678
    px, py = lat_lng_to_pixel(lat, lng, 19)
    lat2, lng2 = pixel_to_lat_lng(px, py, 19)
    assert abs(lat - lat2) < 1e-6
    assert abs(lng - lng2) < 1e-6


def test_bbox_centre_matches_tile_centre() -> None:
    center_lat, center_lng = 51.531, -0.2678
    lat, lng = pixel_bbox_to_lat_lng(
        320, 320,
        640, 640,
        center_lat, center_lng,
        19,
    )
    assert abs(lat - center_lat) < 1e-6
    assert abs(lng - center_lng) < 1e-6
