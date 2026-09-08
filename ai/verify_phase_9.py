import sys
from impact_analyser import ImpactAnalyser

def assert_equal(val, expected, msg):
    if val == expected:
        print(f"  PASS: {msg}")
        return True
    else:
        print(f"  FAIL: {msg} (Expected {expected}, got {val})")
        return False

def test_suite():
    print("=== Starting Phase 9 Project Impact Analyser Verification ===")
    
    analyser = ImpactAnalyser()
    report = []

    def run_case(id, desc, fn):
        print(f"\n--- Running {id}: {desc} ---")
        try:
            outcome = fn()
            status = "PASS" if outcome else "FAIL"
        except Exception as e:
            print(f"  ERROR: {e}")
            status = "FAIL"
        report.append((id, desc, status))

    # TC-1: Valid project report
    def tc1():
        text = "The education project was successfully completed. We trained 50 teachers and built 3 schools. The total budget spent was $15,000. Overall, student satisfaction improved by 30%."
        res = analyser.analyse(text)
        
        has_outcomes = len(res["extracted_indicators"]["outcomes"]) > 0
        has_completion = len(res["extracted_indicators"]["completion_indicators"]) > 0
        has_utilization = len(res["extracted_indicators"]["utilization_info"]) > 0
        has_metrics = len(res["extracted_indicators"]["impact_indicators"]) > 0
        
        return (
            assert_equal(has_outcomes, True, "Outcomes extracted") and
            assert_equal(has_completion, True, "Completion indicators extracted") and
            assert_equal(has_utilization, True, "Utilization info extracted") and
            assert_equal(has_metrics, True, "Impact metrics extracted")
        )
    run_case("TC-1", "Valid project report information extraction", tc1)

    # TC-2: Report with beneficiary count
    def tc2():
        text = "We served 1500 families in the drought-affected area by providing clean drinking water."
        res = analyser.analyse(text)
        val = res["extracted_indicators"]["beneficiary_count"]
        return assert_equal(val, 1500, "Beneficiary count correctly extracted as 1500")
    run_case("TC-2", "Report with beneficiary count", tc2)

    # TC-3: Report with no beneficiary count
    def tc3():
        text = "The team conducted classes on basic hygiene and sanitation. Funds spent were $500."
        res = analyser.analyse(text)
        val = res["extracted_indicators"]["beneficiary_count"]
        return assert_equal(val, None, "Beneficiary count is None (marked unavailable, not fabricated)")
    run_case("TC-3", "Report with no beneficiary count", tc3)

    # TC-4: Report with clear positive outcomes
    def tc4():
        text = "The healthcare initiative was a huge success. We established 10 new clinics. General patient wellness increased significantly, and child vaccination rates improved by 40%."
        res = analyser.analyse(text)
        score = res["impact_score"]
        level = res["impact_level"]
        print(f"  Score: {score}, Level: {level}")
        # Positive sentiment, outcome, clinics should give a good score
        return (
            assert_equal(score >= 5.0, True, "Impact score is high/medium") and
            assert_equal(level in ["MEDIUM", "HIGH"], True, "Impact level is MEDIUM or HIGH")
        )
    run_case("TC-4", "Report with clear positive outcomes", tc4)

    # TC-5: Report with poor/incomplete outcomes
    def tc5():
        text = "The project encountered severe delays and budget cuts. Most milestones were missed. Very few achievements were recorded."
        res = analyser.analyse(text)
        score = res["impact_score"]
        level = res["impact_level"]
        print(f"  Score: {score}, Level: {level}")
        # Negative sentiment, missing beneficiary, utilization, etc. should give a low score
        return (
            assert_equal(score < 3.5, True, "Impact score is low") and
            assert_equal(level, "LOW", "Impact level is LOW")
        )
    run_case("TC-5", "Report with poor/incomplete outcomes", tc5)

    # TC-6: Empty report
    def tc6():
        try:
            analyser.analyse("   ")
            print("  FAIL: Did not raise ValueError for empty report")
            return False
        except ValueError as e:
            return assert_equal("empty or contains only whitespace" in str(e), True, "Raises ValueError on empty report")
    run_case("TC-6", "Empty report input validation", tc6)

    # TC-7: Unrelated text
    def tc7():
        text = "How to cook a chocolate cake: mix 2 eggs, 1 cup of flour, and 100g of chocolate. Bake for 30 minutes at 180 degrees Celsius."
        res = analyser.analyse(text)
        
        # System should not fabricate project indicators
        ext = res["extracted_indicators"]
        all_empty = (
            ext["beneficiary_count"] is None and
            len(ext["outcomes"]) == 0 and
            len(ext["completion_indicators"]) == 0 and
            len(ext["utilization_info"]) == 0 and
            len(ext["impact_indicators"]) == 0
        )
        level = res["impact_level"]
        score = res["impact_score"]
        
        return (
            assert_equal(all_empty, True, "Unrelated text results in empty indicators") and
            assert_equal(level, "LOW", "Unrelated text results in LOW impact level") and
            assert_equal(score, 0.0, "Unrelated text results in 0.0 impact score")
        )
    run_case("TC-7", "Unrelated text indicators and scoring", tc7)

    # TC-8: Malformed input
    def tc8():
        try:
            analyser.analyse(12345)
            print("  FAIL: Did not raise TypeError for integer input")
            return False
        except TypeError as e:
            type_ok = assert_equal("must be a string value" in str(e), True, "Raises TypeError on non-string input")
            
        try:
            analyser.analyse(None)
            print("  FAIL: Did not raise ValueError for None input")
            return False
        except ValueError as e:
            val_ok = assert_equal("cannot be None" in str(e), True, "Raises ValueError on None input")
            
        return type_ok and val_ok
    run_case("TC-8", "Malformed inputs (non-string and None)", tc8)

    # TC-9: Same report submitted twice
    def tc9():
        text = "The team delivered 300 meals to homeless individuals. Financial budget utilized was $1,200."
        res1 = analyser.analyse(text)
        res2 = analyser.analyse(text)
        
        # Verify deterministic output
        match_score = res1["impact_score"] == res2["impact_score"]
        match_level = res1["impact_level"] == res2["impact_level"]
        match_summary = res1["generated_summary"] == res2["generated_summary"]
        match_beneficiary = res1["extracted_indicators"]["beneficiary_count"] == res2["extracted_indicators"]["beneficiary_count"]
        
        return (
            assert_equal(match_score, True, "Identical impact score") and
            assert_equal(match_level, True, "Identical impact level") and
            assert_equal(match_summary, True, "Identical generated summary") and
            assert_equal(match_beneficiary, True, "Identical beneficiary count")
        )
    run_case("TC-9", "Deterministic consistent results", tc9)

    # TC-10: Verify output follows the documented schema
    def tc10():
        text = "The education project reached 200 youths. Funds utilized were $5,000. Outcomes include higher literacy rates."
        res = analyser.analyse(text)
        
        # Check high-level keys
        has_keys = (
            "extracted_indicators" in res and
            "completeness_indicators" in res and
            "impact_score" in res and
            "impact_level" in res and
            "generated_summary" in res and
            "confidence_information" in res
        )
        
        # Check subkeys
        has_subkeys1 = (
            "beneficiary_count" in res["extracted_indicators"] and
            "outcomes" in res["extracted_indicators"] and
            "completion_indicators" in res["extracted_indicators"] and
            "utilization_info" in res["extracted_indicators"] and
            "impact_indicators" in res["extracted_indicators"]
        )
        
        has_subkeys2 = (
            "beneficiary_count_present" in res["completeness_indicators"] and
            "outcomes_present" in res["completeness_indicators"] and
            "completion_indicators_present" in res["completeness_indicators"] and
            "utilization_info_present" in res["completeness_indicators"] and
            "impact_indicators_present" in res["completeness_indicators"] and
            "completeness_score" in res["completeness_indicators"]
        )
        
        has_subkeys3 = (
            "confidence_score" in res["confidence_information"] and
            "limitations" in res["confidence_information"] and
            "disclaimer" in res["confidence_information"]
        )
        
        # Check types
        types_ok = (
            isinstance(res["impact_score"], float) and
            res["impact_level"] in ["LOW", "MEDIUM", "HIGH"] and
            isinstance(res["generated_summary"], str) and
            isinstance(res["confidence_information"]["limitations"], list) and
            res["confidence_information"]["disclaimer"] == "This is an AI-assisted assessment and does not objectively prove social impact."
        )
        
        return (
            assert_equal(has_keys, True, "Has all top-level keys") and
            assert_equal(has_subkeys1, True, "Has all extracted_indicators subkeys") and
            assert_equal(has_subkeys2, True, "Has all completeness_indicators subkeys") and
            assert_equal(has_subkeys3, True, "Has all confidence_information subkeys") and
            assert_equal(types_ok, True, "Has valid field types and disclaimer matches schema")
        )
    run_case("TC-10", "Verify output schema compliance", tc10)

    # TC-11: Verify no unsupported claims are generated from absent information
    def tc11():
        text = "This report has no other details."
        res = analyser.analyse(text)
        
        # Summary should not mention beneficiaries or budgets since they are absent
        summary = res["generated_summary"]
        print(f"  Summary: {summary}")
        
        no_fake_beneficiaries = "beneficiaries" not in summary.lower() and "reached" not in summary.lower()
        no_fake_utilization = "financial" not in summary.lower() and "utilization" not in summary.lower()
        
        # The summary should be indicating insufficient details or only general items if available
        return (
            assert_equal(no_fake_beneficiaries, True, "No fake beneficiary claims made in summary") and
            assert_equal(no_fake_utilization, True, "No fake utilization claims made in summary")
        )
    run_case("TC-11", "Verify no unsupported claims are generated", tc11)

    print("\n=== Phase 9 Test Run Completed ===")
    all_pass = True
    for item in report:
        print(f"{item[0]}: {item[2]} - {item[1]}")
        if item[2] == "FAIL":
            all_pass = False

    if all_pass:
        print("ALL TESTS PASSED.")
        sys.exit(0)
    else:
        print("SOME TESTS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    test_suite()
