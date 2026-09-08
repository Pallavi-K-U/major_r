import re
import spacy
from typing import Dict, Any, Union

class ImpactAnalyser:
    """
    AI-Assisted Project Impact-Analysis Module.
    
    Parses project reports to extract key indicators (beneficiaries, outcomes, 
    completion indicators, utilization information, and impact indicators),
    evaluates a completeness and sentiment-based impact score, and assigns
    an impact level.
    
    Disclaimer:
    This is an AI-assisted assessment and does not objectively prove social impact.
    """
    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except Exception:
            self.nlp = None

        # Lemmatized keyword sets for robust matching
        self.outcome_keywords = {
            "improve", "improvement", "increase", "decrease", "result", "impact", 
            "outcome", "establish", "train", "build", "provide", "deliver", 
            "reduce", "enhance", "success", "achieve", "achievement"
        }
        self.completion_keywords = {
            "complete", "completion", "finish", "finalize", "conclude", "fully", 
            "done", "deliver", "achieve", "success"
        }
        self.utilization_keywords = {
            "spend", "utilize", "utilization", "allocate", "allocation", "funds", 
            "budget", "expenditure", "cost", "financial", "expend", "disburse"
        }
        self.beneficiary_keywords = {
            "beneficiary", "people", "student", "child", "family", "farmer", 
            "patient", "individual", "participant", "villager", "woman", "man", 
            "resident", "citizen", "youth"
        }
        
        # Lemmatized sentiment lexicons for scoring outcomes/impacts
        self.pos_lemmas = {
            "improve", "improvement", "increase", "success", "successful",
            "successfully", "provide", "train", "build", "establish", "help", 
            "support", "benefit", "achieve", "positive", "safe", "clean", 
            "secure", "growth", "gain", "empower"
        }
        self.neg_lemmas = {
            "fail", "failure", "decrease", "reduce", "reduction", "drop", "lack", 
            "poor", "insufficient", "delay", "miss", "unsuccessful", "struggle", 
            "harm"
        }

    def analyse(self, text: str) -> Dict[str, Any]:
        # TC-8: Malformed input (non-string types)
        if text is None:
            raise ValueError("Input text cannot be None")
        if not isinstance(text, str):
            raise TypeError("Input text must be a string value")
            
        # TC-6: Empty report
        stripped_text = text.strip()
        if not stripped_text:
            raise ValueError("Input text is empty or contains only whitespace")

        # Process text with spaCy
        doc = self.nlp(stripped_text) if self.nlp else None
        
        if doc:
            sentences = [sent for sent in doc.sents]
        else:
            # Fallback if spaCy failed
            sentences = []

        # 1. Extract Beneficiary Count (TC-2, TC-3)
        beneficiary_count = self._extract_beneficiary_count(stripped_text, doc)

        # 2. Information Category Extraction
        outcomes = []
        completion_indicators = []
        utilization_info = []
        impact_indicators = []

        for sent in sentences:
            sent_text = sent.text.strip()
            # Extract lemmas
            lemmas = {t.lemma_.lower() for t in sent}
            
            # Check for outcomes
            if lemmas.intersection(self.outcome_keywords):
                outcomes.append(sent_text)
                
            # Check for completion
            if lemmas.intersection(self.completion_keywords):
                completion_indicators.append(sent_text)
                
            # Check for utilization
            if lemmas.intersection(self.utilization_keywords):
                utilization_info.append(sent_text)
                
            # Check for specific impact indicators (metrics / percentages in context)
            sent_lower = sent_text.lower()
            has_metric = bool(re.search(
                r'\b\d+\s*%|\b\d+\s+(?:percent|units?|clinics?|schools?|wells?|jobs?|acres?|teachers?|students?|patients?|farmers?|famil(?:y|ies))\b', 
                sent_lower
            ))
            if has_metric and (lemmas.intersection(self.outcome_keywords) or lemmas.intersection(self.beneficiary_keywords)):
                impact_indicators.append(sent_text)

        # 3. Completeness Indicators
        beneficiary_count_present = beneficiary_count is not None
        outcomes_present = len(outcomes) > 0
        completion_indicators_present = len(completion_indicators) > 0
        utilization_info_present = len(utilization_info) > 0
        impact_indicators_present = len(impact_indicators) > 0

        present_count = sum([
            beneficiary_count_present,
            outcomes_present,
            completion_indicators_present,
            utilization_info_present,
            impact_indicators_present
        ])
        completeness_score = round(present_count / 5.0, 2)

        # 4. Sentiment Polarity Scoring
        pos_count = 0
        neg_count = 0
        
        # Combine unique extracted sentences to avoid double counting
        unique_sentences = list(set(outcomes + completion_indicators + utilization_info + impact_indicators))
        combined_text = " ".join(unique_sentences)
        combined_doc = self.nlp(combined_text) if self.nlp else None
        
        if combined_doc:
            for token in combined_doc:
                lemma = token.lemma_.lower()
                if lemma in self.pos_lemmas:
                    pos_count += 1
                elif lemma in self.neg_lemmas:
                    neg_count += 1

        # 5. Calculate Impact Score (0.0 to 10.0)
        if present_count == 0:
            impact_score = 0.0
        else:
            # Completeness base (max 4.0)
            base_score = completeness_score * 4.0
            
            # Sentiment adjustments (max 4.0)
            total_sent = pos_count + neg_count
            sentiment_modifier = 0.0
            if total_sent > 0:
                sentiment_modifier = ((pos_count - neg_count) / total_sent) * 4.0
            else:
                # Default neutral sentiment modifier if no positive/negative words matched
                sentiment_modifier = 2.0
                
            # Beneficiary count bonus (max 2.0)
            beneficiary_bonus = 0.0
            if beneficiary_count_present and beneficiary_count > 0:
                beneficiary_bonus = 2.0
                
            impact_score = round(max(0.0, min(10.0, base_score + sentiment_modifier + beneficiary_bonus)), 1)

        # 6. Map Impact Level (LOW, MEDIUM, HIGH)
        if impact_score < 3.5:
            impact_level = "LOW"
        elif impact_score < 7.0:
            impact_level = "MEDIUM"
        else:
            impact_level = "HIGH"

        # 7. Generate Summary (TC-11: No unsupported claims)
        generated_summary = self._generate_summary(
            beneficiary_count, 
            outcomes, 
            completion_indicators, 
            utilization_info, 
            impact_indicators,
            impact_level
        )

        # 8. Confidence and Limitations Info
        confidence_score = round(completeness_score * 0.9, 2) if completeness_score > 0 else 0.0
        
        limitations = []
        if not beneficiary_count_present:
            limitations.append("Beneficiary count is unavailable in the report.")
        if not outcomes_present:
            limitations.append("Outcome descriptions are missing or unrecognized.")
        if not completion_indicators_present:
            limitations.append("Completion status/indicators are not specified.")
        if not utilization_info_present:
            limitations.append("Financial budget or resource utilization information is missing.")
        if not impact_indicators_present:
            limitations.append("Quantitative metrics or project indicators were not detected.")

        return {
            "extracted_indicators": {
                "beneficiary_count": beneficiary_count,
                "outcomes": outcomes,
                "completion_indicators": completion_indicators,
                "utilization_info": utilization_info,
                "impact_indicators": impact_indicators
            },
            "completeness_indicators": {
                "beneficiary_count_present": beneficiary_count_present,
                "outcomes_present": outcomes_present,
                "completion_indicators_present": completion_indicators_present,
                "utilization_info_present": utilization_info_present,
                "impact_indicators_present": impact_indicators_present,
                "completeness_score": completeness_score
            },
            "impact_score": impact_score,
            "impact_level": impact_level,
            "generated_summary": generated_summary,
            "confidence_information": {
                "confidence_score": confidence_score,
                "limitations": limitations,
                "disclaimer": "This is an AI-assisted assessment and does not objectively prove social impact."
            }
        }

    def _extract_beneficiary_count(self, text: str, doc) -> Union[int, None]:
        """
        Attempts to extract a valid beneficiary count from text.
        Returns None if no matching beneficiary count is found.
        """
        ner_matches = []
        if doc:
            for ent in doc.ents:
                if ent.label_ == "CARDINAL":
                    # Check surrounding context (e.g. 5 tokens before and after)
                    start_idx = max(0, ent.start - 5)
                    end_idx = min(len(doc), ent.end + 5)
                    context_lemmas = {t.lemma_.lower() for t in doc[start_idx:end_idx]}
                    
                    if context_lemmas.intersection(self.beneficiary_keywords):
                        # Try to parse ent.text as int
                        num_str = re.sub(r'[^\d]', '', ent.text)
                        if num_str.isdigit():
                            ner_matches.append(int(num_str))

        # Regex fallback
        regex_matches = []
        pattern = r'\b(\d{1,3}(?:,\d{3})+|\d+)\s*(?:direct|indirect)?\s*(?:beneficiary|beneficiaries|people|individual|individuals|student|students|child|children|patient|patients|family|families|farmer|farmers|participant|participants|villager|villagers|citizen|citizens)\b'
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for m in matches:
            num_str = m.group(1).replace(",", "")
            if num_str.isdigit():
                regex_matches.append(int(num_str))

        all_candidates = regex_matches + ner_matches
        
        if all_candidates:
            if regex_matches:
                return regex_matches[0]
            return all_candidates[0]

        return None

    def _generate_summary(self, beneficiary_count, outcomes, completion, utilization, impacts, level) -> str:
        """
        Generates a summary based ONLY on existing extracted facts.
        TC-11: No unsupported claims generated from absent information.
        """
        if not outcomes and not beneficiary_count and not completion and not utilization:
            return "Insufficient project outcome data was provided in the report to summarize achievements."

        summary_parts = []
        
        if outcomes:
            summary_parts.append("The report outlines positive outcomes: " + " ".join(outcomes[:2]))
        
        if beneficiary_count is not None:
            summary_parts.append(f"The project directly reached {beneficiary_count:,} beneficiaries.")
            
        if completion:
            summary_parts.append("Completion status highlights include: " + " ".join(completion[:1]))
            
        if utilization:
            summary_parts.append("Financial utilization details specify: " + " ".join(utilization[:1]))

        summary_parts.append(f"Overall, the AI-assisted assessment indicates a {level} impact level.")
        
        return " ".join(summary_parts)
