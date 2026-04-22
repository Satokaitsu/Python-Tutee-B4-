import json
import glob
import os
import statistics

def analyze_session(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    session_id = data.get('session_id', 'unknown')
    user_id = data.get('user_id', 'unknown')
    messages = data.get('message_history', [])

    user_lengths = []
    agent_lengths = []
    
    transcript = []

    for i, msg in enumerate(messages):
        role = msg.get('role')
        text = msg.get('text', '').strip()
        
        if not text:
            continue

        length = len(text)

        if role == 'user':
            user_lengths.append(length)
            # Context from previous agent message (if exists)
            prev_msg = messages[i-1].get('text', '')[:100] + "..." if i > 0 and messages[i-1].get('role') == 'agent' else "N/A"
            transcript.append(f"Session: {session_id} | Index: {i} | Role: User\nContext (Agent): {prev_msg}\nContent: {text}\n---")
        elif role == 'agent':
            agent_lengths.append(length)

    return {
        'session_id': session_id,
        'user_id': user_id,
        'user_lengths': user_lengths,
        'agent_lengths': agent_lengths,
        'transcript': transcript
    }

def main():
    files = glob.glob('data/mock_sessions/sess_M_*.json')
    all_user_lengths = []
    all_agent_lengths = []
    transcripts = []

    print(f"Found {len(files)} session files.")
    
    results = []

    for file_path in files:
        res = analyze_session(file_path)
        username = res['user_id']
        u_avg = statistics.mean(res['user_lengths']) if res['user_lengths'] else 0
        a_avg = statistics.mean(res['agent_lengths']) if res['agent_lengths'] else 0
        
        print(f"User: {username} ({res['session_id']})")
        print(f"  User Avg Char Count: {u_avg:.2f} (n={len(res['user_lengths'])})")
        print(f"  Agent Avg Char Count: {a_avg:.2f} (n={len(res['agent_lengths'])})")
        
        all_user_lengths.extend(res['user_lengths'])
        all_agent_lengths.extend(res['agent_lengths'])
        transcripts.extend(res['transcript'])
        
        results.append({
            'user': username,
            'user_avg': u_avg,
            'agent_avg': a_avg
        })

    print("-" * 30)
    print("Overall Statistics:")
    overall_user_avg = statistics.mean(all_user_lengths) if all_user_lengths else 0
    overall_agent_avg = statistics.mean(all_agent_lengths) if all_agent_lengths else 0
    print(f"Overall User Avg Char Count: {overall_user_avg:.2f} (n={len(all_user_lengths)})")
    print(f"Overall Agent Avg Char Count: {overall_agent_avg:.2f} (n={len(all_agent_lengths)})")

    # Save transcript for manual classification
    with open('users_transcripts_for_classification.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(transcripts))
    print("Transcripts saved to users_transcripts_for_classification.txt")

if __name__ == "__main__":
    main()
