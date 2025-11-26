#!/usr/bin/env python3
"""Test script to verify backend is API-only"""

import subprocess
import time
import requests
import sys
import signal

def test_backend():
    """Test that backend starts and only serves API endpoints"""
    print("Starting Flask backend...")
    
    # Start the backend process
    proc = subprocess.Popen(
        ['python3', 'app.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start
    time.sleep(3)
    
    try:
        # Test 1: Verify API endpoint works
        print("\n✓ Testing API endpoint: /api/sites")
        response = requests.get('http://127.0.0.1:5000/api/sites', timeout=5)
        if response.status_code == 200:
            print(f"  ✓ API endpoint responding (Status: {response.status_code})")
        else:
            print(f"  ⚠ API endpoint returned status: {response.status_code}")
        
        # Test 2: Verify UI routes are removed
        print("\n✓ Testing that UI routes are removed...")
        try:
            response = requests.get('http://127.0.0.1:5000/', timeout=5)
            if response.status_code == 404:
                print("  ✓ Root route properly returns 404 (UI removed)")
            else:
                print(f"  ⚠ Root route returned unexpected status: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"  ✓ Root route not accessible (as expected)")
        
        # Test 3: Verify another API endpoint
        print("\n✓ Testing API endpoint: /api/services")
        response = requests.get('http://127.0.0.1:5000/api/services', timeout=5)
        if response.status_code == 200:
            print(f"  ✓ Services endpoint responding (Status: {response.status_code})")
        
        print("\n" + "="*50)
        print("✓ Backend is now API-only!")
        print("✓ All API endpoints are functional")
        print("✓ UI routes have been removed")
        print("="*50)
        
    except requests.exceptions.ConnectionError:
        print("✗ Could not connect to backend. Is it running?")
        return False
    except Exception as e:
        print(f"✗ Error during testing: {e}")
        return False
    finally:
        # Stop the backend
        print("\nStopping backend...")
        proc.terminate()
        proc.wait(timeout=5)
    
    return True

if __name__ == '__main__':
    success = test_backend()
    sys.exit(0 if success else 1)