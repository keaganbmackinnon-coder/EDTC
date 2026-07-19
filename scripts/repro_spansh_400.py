import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(timeout=20, headers={"User-Agent": "EDTC/0.3.76"}) as c:
        for ref in ["Kuk", "kuk", "KUK", "meliae", "Kuk ", " Kuk", "G9L-N4H", "shinrarta dezhra"]:
            r = await c.post("https://spansh.co.uk/api/stations/search", json={
                "reference_system": ref,
                "filters": {"material_trader": {"value": ["Raw"]}},
                "sort": [{"distance": {"direction": "asc"}}],
                "size": 3,
            })
            if r.status_code == 200:
                print(f"200 {ref!r:22} count={r.json().get('count')}")
            else:
                print(f"{r.status_code} {ref!r:22} body={r.text[:150]}")

asyncio.run(main())
