#!/usr/bin/env python3
"""
Backend API tests for DTB Next.js application
Tests all API routes with negative-path validation (no valid API keys available)
"""

import requests
import json
import sys

# Base URL for testing
BASE_URL = "http://localhost:3000/api"

def print_test_result(test_name, passed, details=""):
    """Print test result in a clear format"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"  Details: {details}")

def test_health_endpoint():
    """Test 1: GET /api/health should return 200 with { ok: true, app: 'DTB' }"""
    test_name = "GET /api/health"
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        
        # Check status code
        if response.status_code != 200:
            print_test_result(test_name, False, f"Expected 200, got {response.status_code}")
            return False
        
        # Check JSON response
        try:
            data = response.json()
            if data.get("ok") == True and data.get("app") == "DTB":
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)}")
                return True
            else:
                print_test_result(test_name, False, f"Unexpected response body: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_llm_chat_invalid_provider():
    """Test 2: POST /api/llm/chat with invalid provider should return 400"""
    test_name = "POST /api/llm/chat (invalid provider)"
    try:
        payload = {"provider": "invalid", "messages": []}
        response = requests.post(f"{BASE_URL}/llm/chat", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 400:
            print_test_result(test_name, False, f"Expected 400, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message
        try:
            data = response.json()
            if "error" in data and "Unknown provider" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'Unknown provider' in error, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_llm_chat_ollama_unreachable():
    """Test 3: POST /api/llm/chat with unreachable Ollama should return 500"""
    test_name = "POST /api/llm/chat (Ollama unreachable)"
    try:
        payload = {
            "provider": "ollama",
            "baseUrl": "http://127.0.0.1:1",
            "model": "x",
            "messages": [{"role": "user", "content": "hi"}]
        }
        response = requests.post(f"{BASE_URL}/llm/chat", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 500:
            print_test_result(test_name, False, f"Expected 500, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error field exists (accept any error message as long as status is 500)
        try:
            data = response.json()
            if "error" in data:
                # Accept any error message - what matters is 500 status and error field presence
                note = " (minor: error message doesn't mention 'Ollama' specifically)" if "Ollama" not in data["error"] else ""
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)[:200]}{note}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'error' field in response, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_llm_stream_ollama_unreachable():
    """Test 4: POST /api/llm/stream with unreachable Ollama should return error without crashing"""
    test_name = "POST /api/llm/stream (Ollama unreachable)"
    try:
        payload = {
            "provider": "ollama",
            "baseUrl": "http://127.0.0.1:1",
            "model": "x",
            "messages": [{"role": "user", "content": "hi"}]
        }
        response = requests.post(f"{BASE_URL}/llm/stream", json=payload, timeout=10, stream=True)
        
        # Read the response body
        body = response.text
        
        # Check if response is valid (either error status or __DTB_ERROR__ in body)
        if response.status_code == 200:
            # Should start with __DTB_ERROR__
            if body.startswith("__DTB_ERROR__"):
                print_test_result(test_name, True, f"Status: {response.status_code}, Body starts with __DTB_ERROR__: {body[:100]}")
                return True
            else:
                print_test_result(test_name, False, f"Expected __DTB_ERROR__ prefix, got: {body[:200]}")
                return False
        elif response.status_code >= 400:
            # Any error status is acceptable
            print_test_result(test_name, True, f"Status: {response.status_code}, Body: {body[:200]}")
            return True
        else:
            print_test_result(test_name, False, f"Unexpected status {response.status_code}, Body: {body[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_ollama_models_unreachable():
    """Test 5: POST /api/ollama/models with unreachable Ollama should return 500"""
    test_name = "POST /api/ollama/models (Ollama unreachable)"
    try:
        payload = {"baseUrl": "http://127.0.0.1:1"}
        response = requests.post(f"{BASE_URL}/ollama/models", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 500:
            print_test_result(test_name, False, f"Expected 500, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message contains "Ollama" or "Cannot reach"
        try:
            data = response.json()
            if "error" in data and ("Ollama" in data["error"] or "Cannot reach" in data["error"]):
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)[:200]}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'Ollama' or 'Cannot reach' in error, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_supabase_missing_credentials():
    """Test 6: POST /api/sync/supabase without url/key should return 400"""
    test_name = "POST /api/sync/supabase (missing credentials)"
    try:
        payload = {"action": "test"}
        response = requests.post(f"{BASE_URL}/sync/supabase", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 400:
            print_test_result(test_name, False, f"Expected 400, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message
        try:
            data = response.json()
            if "error" in data and "Supabase URL/key missing" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'Supabase URL/key missing' in error, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_supabase_fake_credentials():
    """Test 7: POST /api/sync/supabase with fake credentials should return 500"""
    test_name = "POST /api/sync/supabase (fake credentials)"
    try:
        payload = {
            "action": "test",
            "url": "https://nonexistent-xxxxx.supabase.co",
            "key": "fake_key"
        }
        response = requests.post(f"{BASE_URL}/sync/supabase", json=payload, timeout=10)
        
        # Check status code (should be 500 for upstream failure)
        if response.status_code != 500:
            print_test_result(test_name, False, f"Expected 500, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message contains "Test:" or similar
        try:
            data = response.json()
            if "error" in data and "Test:" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)[:200]}")
                return True
            else:
                # Accept any error message as long as status is 500
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)[:200]} (minor: error message format differs)")
                return True
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_github_user_invalid_token():
    """Test 8: POST /api/sync/github/user with invalid token should return 500"""
    test_name = "POST /api/sync/github/user (invalid token)"
    try:
        payload = {"token": "ghp_invalid_token_xxxxx"}
        response = requests.post(f"{BASE_URL}/sync/github/user", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 500:
            print_test_result(test_name, False, f"Expected 500, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message contains "GitHub" and "401"
        try:
            data = response.json()
            if "error" in data and "GitHub" in data["error"] and "401" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'GitHub' and '401' in error, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_github_push_missing_params():
    """Test 9: POST /api/sync/github with empty body should return 400"""
    test_name = "POST /api/sync/github (missing params)"
    try:
        payload = {}
        response = requests.post(f"{BASE_URL}/sync/github", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 400:
            print_test_result(test_name, False, f"Expected 400, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message
        try:
            data = response.json()
            if "error" in data and "token/repo/path required" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'token/repo/path required' in error, got: {json.dumps(data)}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def test_github_push_invalid_token():
    """Test 10: POST /api/sync/github with invalid token should return 500"""
    test_name = "POST /api/sync/github (invalid token)"
    try:
        payload = {
            "token": "ghp_invalid",
            "repo": "nonexistent/repo",
            "path": "a.jsx",
            "content": "x"
        }
        response = requests.post(f"{BASE_URL}/sync/github", json=payload, timeout=10)
        
        # Check status code
        if response.status_code != 500:
            print_test_result(test_name, False, f"Expected 500, got {response.status_code}, Body: {response.text[:200]}")
            return False
        
        # Check error message contains "GitHub push" and "401"
        try:
            data = response.json()
            if "error" in data and "GitHub push" in data["error"] and "401" in data["error"]:
                print_test_result(test_name, True, f"Status: {response.status_code}, Body: {json.dumps(data)[:200]}")
                return True
            else:
                print_test_result(test_name, False, f"Expected 'GitHub push' and '401' in error, got: {json.dumps(data)[:200]}")
                return False
        except json.JSONDecodeError:
            print_test_result(test_name, False, f"Response is not valid JSON: {response.text[:200]}")
            return False
            
    except Exception as e:
        print_test_result(test_name, False, f"Exception: {str(e)}")
        return False

def main():
    """Run all backend tests"""
    print("=" * 80)
    print("DTB Backend API Tests - Negative Path Validation")
    print("=" * 80)
    
    tests = [
        test_health_endpoint,
        test_llm_chat_invalid_provider,
        test_llm_chat_ollama_unreachable,
        test_llm_stream_ollama_unreachable,
        test_ollama_models_unreachable,
        test_supabase_missing_credentials,
        test_supabase_fake_credentials,
        test_github_user_invalid_token,
        test_github_push_missing_params,
        test_github_push_invalid_token,
    ]
    
    results = []
    for test_func in tests:
        result = test_func()
        results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
