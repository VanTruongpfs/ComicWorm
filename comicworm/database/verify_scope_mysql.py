"""Validate the document-scoped schema on an isolated local MySQL process."""
from pathlib import Path
import argparse
import os
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mysql-bin', required=True)
    args = parser.parse_args()
    bin_dir = Path(args.mysql_bin).resolve()
    work = Path(tempfile.mkdtemp(prefix='codex-comicworm-scope-'))
    data, log = work / 'data', work / 'mysqld.log'
    hidden = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    def run(command, **kwargs):
        return subprocess.run(command, capture_output=True, creationflags=hidden, **kwargs)
    mysqld, mysql = str(bin_dir / 'mysqld.exe'), str(bin_dir / 'mysql.exe')
    version = run([mysqld, '--version']).stdout.decode(errors='replace').strip()
    init = run([mysqld, '--no-defaults', '--initialize-insecure', f'--basedir={bin_dir.parent}',
                f'--datadir={data}', f'--log-error={log}'], timeout=90)
    if init.returncode:
        raise RuntimeError(log.read_text(errors='replace'))
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    server = subprocess.Popen([mysqld, '--no-defaults', f'--basedir={bin_dir.parent}', f'--datadir={data}',
                               f'--port={port}', '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin',
                               f'--log-error={log}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=hidden)
    base = [mysql, '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}', '-uroot',
            '--default-character-set=utf8mb4', '--batch', '--skip-column-names']
    def query(sql, database=True, timeout=30):
        return run(base + (['bookmooch_db_v3'] if database else []), input=sql.encode('utf-8'), timeout=timeout)
    report, passed = [version, f'Isolated datadir: {data}', 'Source: Nhom8_ChucNang.docx', ''], 0
    def ok(label, sql, expected=None):
        nonlocal passed
        result = query(sql)
        output = result.stdout.decode('utf-8', errors='replace').strip()
        if result.returncode or (expected is not None and output != expected):
            raise AssertionError(label + '\n' + result.stderr.decode(errors='replace') + '\n' + output)
        passed += 1
        report.append('PASS: ' + label)
    def reject(label, sql, code):
        nonlocal passed
        result = query(sql)
        error = result.stderr.decode('utf-8', errors='replace')
        if result.returncode == 0 or f'ERROR {code} ' not in error:
            raise AssertionError(label + '\n' + error)
        passed += 1
        report.append('PASS: rejects ' + label)
    try:
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            ready = query('SELECT @@datadir;', database=False)
            if ready.returncode == 0:
                assert Path(ready.stdout.decode().strip()).resolve() == data.resolve()
                break
            if server.poll() is not None:
                raise RuntimeError(log.read_text(errors='replace'))
            time.sleep(0.25)
        else:
            raise RuntimeError('MySQL startup timed out')
        ddl = query((ROOT / 'schema.sql').read_text(encoding='utf-8-sig'), database=False, timeout=120)
        if ddl.returncode:
            raise AssertionError(ddl.stderr.decode(errors='replace'))
        report.append('PASS: DDL imports with all FK/CHECK constraints')
        print('DDL import passed; testing the reduced schema.', flush=True)
        ok('reference seed', (ROOT / 'seed.sql').read_text(encoding='utf-8-sig'))
        ok('32 tables / 232 columns / 49 foreign keys', "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()),(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE()),(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE());", '32\t232\t49')
        ok('out-of-scope modules are absent', "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('wallets','transactions','withdraw_requests','vouchers','voucher_usages','user_kyc','fee_policies','platform_revenues','support_tickets','post_reports','appeal_requests','want_list_posts','order_disputes','seller_shops','staff_profiles','permissions');", '0')
        ok('local and Google-only login identities', "INSERT INTO users (id,email,password_hash,full_name,is_seller) VALUES (101,'buyer@test.invalid','test-only-hash','Buyer',FALSE),(102,'seller@test.invalid','test-only-hash','Seller',TRUE),(103,'other@test.invalid','test-only-hash','Other',FALSE); INSERT INTO users (id,email,google_sub,full_name) VALUES (104,'google@test.invalid','google-test-subject','Google user');")
        reject('account without password or Google identity', "INSERT INTO users(email,full_name) VALUES ('no-login@test.invalid','None');", 3819)
        reject('duplicate Google subject', "INSERT INTO users(email,google_sub,full_name) VALUES ('dup-google@test.invalid','google-test-subject','Dup');", 1062)
        ok('logout revokes the session and reset token can be consumed', "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES (101,REPEAT('a',64),DATE_ADD(NOW(),INTERVAL 1 DAY)); UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=101; INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES (101,REPEAT('b',64),DATE_ADD(NOW(),INTERVAL 15 MINUTE)); UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=101;")
        ok('catalog fixtures with seller/filters/images', "INSERT INTO products(id,seller_id,title,slug,description,category_id,condition_percent,price,stock_quantity,moderation_status) VALUES (101,102,'Book','book','Description',1,90,100000,3,'APPROVED'),(102,101,'Trade book','trade-book','Description',1,95,50000,1,'APPROVED'); INSERT INTO product_images(id,product_id,image_url) VALUES (101,101,'https://example.invalid/book.jpg');")
        reject('negative stock', 'UPDATE products SET stock_quantity=-1 WHERE id=101;', 3819)
        ok('cart row', 'INSERT INTO carts(id,user_id) VALUES (101,101); INSERT INTO cart_items(cart_id,product_id,quantity) VALUES (101,101,1);')
        reject('duplicate cart product', 'INSERT INTO cart_items(cart_id,product_id) VALUES (101,101);', 1062)
        ok('checkout/order snapshots', "INSERT INTO checkout_batches(id,checkout_code,buyer_id,idempotency_key,total_amount,expires_at) VALUES (101,'CHECKOUT-T',101,'checkout-t',110000,DATE_ADD(NOW(),INTERVAL 15 MINUTE)); INSERT INTO orders(id,order_code,checkout_id,buyer_id,seller_id,subtotal_amount,shipping_fee,total_amount,recipient_name,recipient_phone,shipping_address) VALUES (101,'ORDER-T',101,101,102,100000,10000,110000,'Buyer','000','Address'); INSERT INTO order_items(id,order_id,product_id,product_title,condition_percent,unit_price,quantity) VALUES (101,101,101,'Book snapshot',90,100000,1);")
        reject('order total mismatch', 'UPDATE orders SET total_amount=1 WHERE id=101;', 3819)
        ok('online payment allocation and callback', "INSERT INTO payments(id,payment_code,checkout_id,method,amount,idempotency_key) VALUES (101,'PAY-T',101,'VNPAY',110000,'payment-t'); INSERT INTO payment_allocations(payment_id,order_id,amount) VALUES (101,101,110000); INSERT INTO payment_events(payment_id,provider_event_id,event_type,signature_verified) VALUES (101,'EVENT-T','PAID',TRUE);")
        reject('duplicate payment callback', "INSERT INTO payment_events(payment_id,provider_event_id,event_type) VALUES (101,'EVENT-T','PAID');", 1062)
        ok('order cancellation/history/notification/refund', "UPDATE orders SET status='CANCELLED',cancelled_by=101,cancelled_at=NOW(),cancel_reason='Changed mind' WHERE id=101; INSERT INTO order_status_history(order_id,previous_status,new_status,changed_by) VALUES (101,'WAITING_PAYMENT','CANCELLED',101); INSERT INTO notifications(user_id,order_id,title,content,deduplication_key) VALUES (101,101,'Cancelled','Order cancelled','order-cancel-t'); INSERT INTO refunds(refund_code,payment_id,order_id,amount,idempotency_key) VALUES ('REFUND-T',101,101,110000,'refund-t');")
        reject('refund without paid order allocation', "INSERT INTO refunds(refund_code,payment_id,order_id,amount,idempotency_key) VALUES ('REFUND-WRONG',102,101,100,'refund-wrong');", 1452)
        ok('purchased item review and seller reply', "INSERT INTO reviews(id,order_item_id,buyer_id,rating,content) VALUES (101,101,101,5,'Good'); INSERT INTO review_replies(review_id,seller_id,content) VALUES (101,102,'Thanks');")
        reject('second review for one purchased item', 'INSERT INTO reviews(order_item_id,buyer_id,rating) VALUES (101,101,4);', 1062)
        ok('loyalty posting', "INSERT INTO loyalty_accounts(user_id,points_balance) VALUES (101,100); INSERT INTO loyalty_transactions(user_id,order_id,transaction_type,points_delta,balance_after,idempotency_key) VALUES (101,101,'EARN',100,100,'points-t');")
        reject('double earning on retried key', "INSERT INTO loyalty_transactions(user_id,order_id,transaction_type,points_delta,balance_after,idempotency_key) VALUES (101,101,'EARN',100,200,'points-t');", 1062)
        ok('exchange room members and item proposal', "INSERT INTO exchange_rooms(id,room_code,host_id,target_product_id) VALUES (101,'ROOM-T',102,101),(102,'ROOM-T2',102,101); INSERT INTO exchange_room_members(room_id,user_id) VALUES (101,101),(101,102),(102,101),(102,102); INSERT INTO exchange_offers(id,room_id,buyer_id) VALUES (101,101,101),(102,102,101); INSERT INTO exchange_offer_items(offer_id,product_id,owner_id,quantity,title_snapshot,condition_snapshot) VALUES (101,102,101,1,'Trade snapshot',95); UPDATE exchange_rooms SET selected_offer_id=101 WHERE id=101;")
        reject('room target belongs to another owner', "INSERT INTO exchange_rooms(room_code,host_id,target_product_id) VALUES ('ROOM-WRONG',103,101);", 1452)
        reject('selecting offer from another room', 'UPDATE exchange_rooms SET selected_offer_id=102 WHERE id=101;', 1452)
        reject('non-member chat sender', "INSERT INTO exchange_messages(room_id,sender_id,content) VALUES (101,103,'Not a member');", 1452)
        ok('valid exchange message', "INSERT INTO exchange_messages(room_id,sender_id,content) VALUES (101,101,'Offer books');")
        ok('image search features and classification result', "INSERT INTO product_image_features(image_id,embedding,model_name) VALUES (101,JSON_ARRAY(0.1,0.2,0.3),'test-model'); INSERT INTO product_classifications(product_id,status,is_comic,confidence,model_name,classified_at) VALUES (101,'SUCCEEDED',TRUE,0.99,'test-classifier',NOW());")
        reject('embedding is not an array', "UPDATE product_image_features SET embedding=JSON_OBJECT('x',1) WHERE image_id=101;", 3819)
        reject('classification success missing result', 'UPDATE product_classifications SET confidence=NULL WHERE product_id=101;', 3819)
        ok('product consultation history', "INSERT INTO consultation_sessions(id,user_id) VALUES (101,101); INSERT INTO consultation_messages(session_id,sender_type,content,suggested_product_ids) VALUES (101,'USER','Suggest a book',NULL),(101,'ASSISTANT','Try this title',JSON_ARRAY(101));")
        ok('all example screen/statistics queries run', (ROOT / 'example_queries.sql').read_text(encoding='utf-8-sig'))
        reject('hard deleting historical seller', 'DELETE FROM users WHERE id=102;', 1451)
        report.append(f'\nCompleted: DDL import + {passed} integration checks.\nScope: 25 functions, 32 tables, 232 columns.\nAPI permissions, actual provider/AI execution and cross-row/concurrent business workflows are not implemented by these schema files.')
        (ROOT / 'validation.txt').write_text('\n'.join(report) + '\n', encoding='utf-8')
        print('\n'.join(report))
    finally:
        if server.poll() is None:
            run([str(bin_dir / 'mysqladmin.exe'), '--no-defaults', '--protocol=TCP', '-h127.0.0.1', f'-P{port}', '-uroot', 'shutdown'], timeout=15)
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.terminate()
                server.wait(timeout=5)


if __name__ == '__main__':
    main()
