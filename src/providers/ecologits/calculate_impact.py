import sys
import json
from ecologits.tracers.utils import llm_impacts
from ecologits.utils.range_value import RangeValue
from model_mappings import detect_provider, get_model_mapping

try:
    # Parse command line arguments
    input_token_count = int(sys.argv[1])
    output_token_count = int(sys.argv[2])
    request_latency = float(sys.argv[3])
    model_name = sys.argv[4]
    electricity_mix_zone = sys.argv[5] if len(sys.argv) > 5 else None
except (ValueError, IndexError) as e:
    error_result = {
        "gwp_g": 0,
        "pe_mj": 0,
        "adpe_kgsbeq": 0,
        "energy_kwh": 0,
        "error": f"Invalid arguments: {str(e)}"
    }
    print(json.dumps(error_result))
    sys.stderr.write(f"Error: Invalid arguments - {str(e)}\n")
    sys.exit(1)

try:
    # Detect provider and get model mapping
    print(f"[EcoPilot] Received model_name: '{model_name}'", file=sys.stderr)
    
    provider = detect_provider(model_name)
    print(f"[EcoPilot] Detected provider: '{provider}'", file=sys.stderr)
    
    mapped_model_name = get_model_mapping(provider, model_name)
    print(f"[EcoPilot] Mapped model name: '{mapped_model_name}'", file=sys.stderr)
    
    if not mapped_model_name:
        error_result = {
            "gwp_g": 0,
            "pe_mj": 0,
            "adpe_kgsbeq": 0,
            "energy_kwh": 0,
            "error": f"Model '{model_name}' not found in EcoLogits repository"
        }
        print(json.dumps(error_result))
        sys.stderr.write(f"Model '{model_name}' not supported by ecologits\n")
        sys.exit(1)
    
    if electricity_mix_zone:
        print(f"[EcoPilot] Using electricity mix zone: '{electricity_mix_zone}'", file=sys.stderr)
    
    # Use llm_impacts to compute environmental impacts
    impacts = llm_impacts(
        provider=provider,
        model_name=mapped_model_name,
        output_token_count=output_token_count,
        request_latency=request_latency,
        electricity_mix_zone=electricity_mix_zone
    )
    
    def get_value(val):
        if isinstance(val, RangeValue):
            return (val.min + val.max) / 2
        return val
    
    gwp_grams = get_value(impacts.gwp.value) * 1000
    pe_mj = get_value(impacts.pe.value)
    adpe_kgsbeq = get_value(impacts.adpe.value)
    energy_kwh = get_value(impacts.energy.value)
    
    usage_gwp_g = get_value(impacts.usage.gwp.value) * 1000 if hasattr(impacts, 'usage') else 0
    usage_pe_mj = get_value(impacts.usage.pe.value) if hasattr(impacts, 'usage') else 0
    usage_adpe = get_value(impacts.usage.adpe.value) if hasattr(impacts, 'usage') else 0
    
    embodied_gwp_g = get_value(impacts.embodied.gwp.value) * 1000 if hasattr(impacts, 'embodied') else 0
    embodied_pe_mj = get_value(impacts.embodied.pe.value) if hasattr(impacts, 'embodied') else 0
    embodied_adpe = get_value(impacts.embodied.adpe.value) if hasattr(impacts, 'embodied') else 0
    
    result = {
        "gwp_g": gwp_grams,
        "pe_mj": pe_mj,
        "adpe_kgsbeq": adpe_kgsbeq,
        "energy_kwh": energy_kwh,
        "usage": {
            "gwp_g": usage_gwp_g,
            "pe_mj": usage_pe_mj,
            "adpe_kgsbeq": usage_adpe
        },
        "embodied": {
            "gwp_g": embodied_gwp_g,
            "pe_mj": embodied_pe_mj,
            "adpe_kgsbeq": embodied_adpe
        },
        "model": model_name,
        "input_tokens": input_token_count,
        "output_tokens": output_token_count,
        "total_tokens": input_token_count + output_token_count,
        "latency": request_latency
    }
    
    print(json.dumps(result))
except Exception as e:
    error_result = {
        "gwp_g": 0,
        "pe_mj": 0,
        "adpe_kgsbeq": 0,
        "energy_kwh": 0,
        "error": str(e)
    }
    print(json.dumps(error_result))
    sys.stderr.write(str(e))