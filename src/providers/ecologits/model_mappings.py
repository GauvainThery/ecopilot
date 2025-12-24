"""
Model name mappings for environmental impact calculations.
Builds mappings from the static ecologits_models_list.py (generated file).
No proxy mappings - only real models with actual environmental data.

To update the base model list:
  .venv/bin/python scripts/generate-ecologits-models.py
"""

from ecologits_models_list import ECOLOGITS_MODELS

# Cache for model mappings (built on first use)
_MODEL_CACHE = None


def _build_model_cache():
    """Build model cache from ecologits models list."""
    cache = {}
    
    for provider_str, models in ECOLOGITS_MODELS.items():
        cache[provider_str] = {}
        
        for model_name in models:
            # Add exact match
            cache[provider_str][model_name] = model_name
            
            # Add lowercase version
            cache[provider_str][model_name.lower()] = model_name
            
            # Add common VS Code variations for specific models
            if provider_str == 'anthropic':
                # VS Code often uses "claude-3.5-sonnet" instead of "claude-3-5-sonnet"
                if 'claude-3-5-' in model_name:
                    alias = model_name.replace('claude-3-5-', 'claude-3.5-')
                    cache[provider_str][alias] = model_name
                if 'claude-3-7-' in model_name:
                    alias = model_name.replace('claude-3-7-', 'claude-3.7-')
                    cache[provider_str][alias] = model_name
                # Handle "latest" suffix variations - create base name without date
                if '-latest' in model_name:
                    # claude-3-5-sonnet-latest -> claude-3-5-sonnet or claude-3.5-sonnet
                    base = model_name.replace('-latest', '')
                    cache[provider_str][base] = model_name
                    # Also add the dot notation version
                    if 'claude-3-5-' in base:
                        dot_base = base.replace('claude-3-5-', 'claude-3.5-')
                        cache[provider_str][dot_base] = model_name
                    if 'claude-3-7-' in base:
                        dot_base = base.replace('claude-3-7-', 'claude-3.7-')
                        cache[provider_str][dot_base] = model_name
            
            elif provider_str == 'openai':
                # VS Code uses "gpt35-turbo" (Azure style)
                if model_name == 'gpt-35-turbo':
                    cache[provider_str]['gpt35-turbo'] = model_name
                # Common shortcuts
                if model_name == 'gpt-3.5-turbo':
                    cache[provider_str]['gpt-3.5'] = model_name
                    cache[provider_str]['gpt35-turbo'] = model_name
    
    return cache


def get_model_cache():
    """Get or build model cache."""
    global _MODEL_CACHE
    if _MODEL_CACHE is None:
        _MODEL_CACHE = _build_model_cache()
    return _MODEL_CACHE


# Provider detection keywords
PROVIDER_KEYWORDS = {
    "anthropic": ["claude"],
    "google": ["gemini"],
    "xai": ["grok"],  # xAI models not in ecologits - will return None
    "mistralai": ["mistral", "codestral", "devstral", "magistral", "ministral", "pixtral", "voxtral"],
    "cohere": ["command", "aya"],
    "openai": []  # Default
}


def detect_provider(model_name: str) -> str:
    """Detect provider from model name."""
    model_lower = model_name.lower()
    
    for provider, keywords in PROVIDER_KEYWORDS.items():
        for keyword in keywords:
            if keyword in model_lower:
                return provider
    
    return "openai"  # Default provider


def get_model_mapping(provider: str, model_name: str) -> str | None:
    """
    Get the mapped model name for a given provider.
    Only returns actual models that exist in ecologits - no proxies or fallbacks.
    
    Args:
        provider: The provider name (openai, anthropic, google, mistralai, cohere)
        model_name: The user-facing model name
    
    Returns:
        The ecologits model name if found, None otherwise
    """
    cache = get_model_cache()
    
    provider_mappings = cache.get(provider, {})
    
    # Try exact match first
    if model_name in provider_mappings:
        return provider_mappings[model_name]
    
    # Try lowercase match
    model_lower = model_name.lower()
    if model_lower in provider_mappings:
        return provider_mappings[model_lower]
    
    # No match found - return None (no proxies)
    return None


