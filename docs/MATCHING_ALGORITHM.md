# Avsar Deterministic Matching Engine

## Formula & Dimension Weights

The overall compatibility score $S_{total}$ is calculated as a bounded weighted composite between 10% and 99%:

$$S_{total} = \text{clamp}(10, 99, 0.40 \cdot S_{skills} + 0.25 \cdot S_{exp} + 0.20 \cdot S_{edu} + 0.15 \cdot S_{loc})$$

### 1. Skills Matching ($S_{skills}$, 40% Weight)
- Calculates intersection of candidate skills $C_{skills}$ and job required skills $J_{req}$.
- Formula:
  $$\text{Coverage}_{req} = \frac{|C_{skills} \cap J_{req}|}{|J_{req}|}$$
- If 100% of required skills are met, optional skills provide a boost up to 100%.
- If no skills are listed in the job specification, the engine extracts domain terms from title/category and defaults to neutral baseline 70%.

### 2. Experience Matching ($S_{exp}$, 25% Weight)
- Calculates candidate verified experience duration $E_{cand}$ in months:
  $$S_{exp} = \begin{cases} 
    \min(100, 85 + \frac{E_{cand}}{E_{req}} \cdot 10) & \text{if } E_{cand} \ge E_{req} \\
    \max(30, \frac{E_{cand}}{E_{req}} \cdot 80) & \text{if } E_{cand} < E_{req} 
  \end{cases}$$
- For entry-level and internship listings ($E_{req} = 0$), candidates with any hands-on experience score 92%, while fresh candidates score 75%.

### 3. Education Matching ($S_{edu}$, 20% Weight)
- Inspects candidate degree level and field of study.
- Technical majors (Computer Science, Information Technology, Software Engineering, B.Tech, B.E., MCA, BCA) score 88%.
- Other accredited degrees score 70%. Empty education records score 40%.

### 4. Location & Work Arrangement ($S_{loc}$, 15% Weight)
- Remote jobs award 100% location score unconditionally.
- Matching candidate city awards 90%. Preferred candidate destination awards 80%. Unmatched locations score 65%.

## Qualitative Rating Labels

- **Strong Match**: $S_{total} \ge 88\%$
- **Good Match**: $72\% \le S_{total} < 88\%$
- **Moderate Match**: $S_{total} < 72\%$

## Hard Eligibility vs Recommendation Scoring

Avsar strictly separates recommendation fit from hard eligibility:
- Match scoring measures candidate profile relevance.
- Eligibility evaluates hard prerequisites (e.g., graduation year batch requirements).
- A candidate in batch 2024 viewing a 2025-only listing will still receive their computed technical match score, but with an explicit warning banner explaining why their graduation year does not match the role criteria.
