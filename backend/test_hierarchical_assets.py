"""
Test script for hierarchical asset API endpoints
Tests the new hierarchical asset structure functionality
"""

import httpx
import asyncio
import json
from typing import List, Dict, Any

BASE_URL = "http://localhost:8000/api"

class AssetAPITester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
    
    async def test_get_root_assets(self):
        """Test: GET /assets (should return only root assets by default)"""
        print("\n📋 Testing: GET /assets (Root assets only)")
        print("=" * 50)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/assets")
            
            if response.status_code == 200:
                assets = response.json()
                print(f"✅ Status: {response.status_code}")
                print(f"✅ Root assets found: {len(assets)}")
                
                for asset in assets:
                    parent_id = asset.get("parentAssetId")
                    print(f"   - {asset['name']} (parent: {parent_id})")
                    if parent_id is not None:
                        print(f"   ⚠️  ERROR: Expected parentAssetId to be None!")
                        return False
                
                return True
            else:
                print(f"❌ Status: {response.status_code}")
                print(response.text)
                return False
    
    async def test_get_assets_by_parent(self, parent_id: str):
        """Test: GET /assets?parent_id={parent_id} (should return children of parent)"""
        print(f"\n📋 Testing: GET /assets?parent_id={parent_id}")
        print("=" * 50)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/assets", params={"parent_id": parent_id})
            
            if response.status_code == 200:
                assets = response.json()
                print(f"✅ Status: {response.status_code}")
                print(f"✅ Child assets found: {len(assets)}")
                
                for asset in assets:
                    returned_parent = asset.get("parentAssetId")
                    print(f"   - {asset['name']} (parent: {returned_parent})")
                    if returned_parent != parent_id:
                        print(f"   ⚠️  ERROR: Expected parentAssetId to be {parent_id}!")
                        return False
                
                return True
            else:
                print(f"❌ Status: {response.status_code}")
                print(response.text)
                return False
    
    async def test_get_all_assets(self):
        """Test: GET /assets?include_all=true (should return all assets)"""
        print("\n📋 Testing: GET /assets?include_all=true (All assets)")
        print("=" * 50)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/assets", params={"include_all": True})
            
            if response.status_code == 200:
                assets = response.json()
                print(f"✅ Status: {response.status_code}")
                print(f"✅ Total assets found: {len(assets)}")
                
                roots = [a for a in assets if a.get("parentAssetId") is None]
                children = [a for a in assets if a.get("parentAssetId") is not None]
                
                print(f"   - Root assets: {len(roots)}")
                print(f"   - Child assets: {len(children)}")
                
                return True
            else:
                print(f"❌ Status: {response.status_code}")
                print(response.text)
                return False
    
    async def test_create_root_asset(self, asset_data: Dict[str, Any]):
        """Test: POST /assets (create root asset)"""
        print(f"\n📋 Testing: POST /assets (Create root asset: {asset_data['name']})")
        print("=" * 50)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/assets",
                json=asset_data
            )
            
            if response.status_code == 201:
                created = response.json()
                print(f"✅ Status: {response.status_code}")
                print(f"✅ Created asset: {created['name']} (ID: {created['id']})")
                return True
            else:
                print(f"❌ Status: {response.status_code}")
                print(response.text)
                return False
    
    async def test_create_child_asset(self, asset_data: Dict[str, Any], parent_id: str):
        """Test: POST /assets (create child asset)"""
        asset_data["parentAssetId"] = parent_id
        print(f"\n📋 Testing: POST /assets (Create child asset: {asset_data['name']} under {parent_id})")
        print("=" * 50)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/assets",
                json=asset_data
            )
            
            if response.status_code == 201:
                created = response.json()
                print(f"✅ Status: {response.status_code}")
                print(f"✅ Created asset: {created['name']} (Parent: {created.get('parentAssetId')})")
                return True
            else:
                print(f"❌ Status: {response.status_code}")
                print(response.text)
                return False
    
    async def run_all_tests(self):
        """Run all tests"""
        print("\n🚀 Starting Hierarchical Asset API Tests")
        print("=" * 50)
        
        results = []
        
        # Test 1: Get root assets
        results.append(("Get root assets", await self.test_get_root_assets()))
        
        # Test 2: Get all assets
        results.append(("Get all assets", await self.test_get_all_assets()))
        
        # Test 3: Get assets by parent (if you have existing data)
        # results.append(("Get assets by parent", await self.test_get_assets_by_parent("interactive-brokers")))
        
        # Print summary
        print("\n\n📊 Test Summary")
        print("=" * 50)
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status}: {test_name}")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        print(f"\nTotal: {passed}/{total} tests passed")


async def main():
    tester = AssetAPITester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
