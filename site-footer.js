(() => {
  const languageKey = 'wavehub.language';
  const translations = {
    Home: 'მთავარი', Marketplace: 'მარკეტი', 'Steam Keys': 'Steam გასაღებები', Coaching: 'ქოუჩინგი', Tournaments: 'ტურნირები',
    'About Us': 'ჩვენ შესახებ', Orders: 'შეკვეთები', Messages: 'შეტყობინებები', Wallet: 'საფულე', Cart: 'კალათა', Favorites: 'რჩეულები', Settings: 'პარამეტრები',
    Search: 'ძიება', 'Become a Seller': 'გახდი გამყიდველი', Profile: 'პროფილი', Notifications: 'შეტყობინებები', Guest: 'სტუმარი', 'Not signed in': 'არ ხართ შესული',
    'Guest account': 'სტუმრის ანგარიში', Username: 'მომხმარებლის სახელი', 'Account details': 'ანგარიშის დეტალები', Login: 'შესვლა', Register: 'რეგისტრაცია', Logout: 'გასვლა',
    'Featured Items': 'რჩეული ნივთები', 'View all': 'ყველას ნახვა', 'View all items': 'ყველა ნივთის ნახვა', 'Featured marketplace items will appear here.': 'რჩეული მარკეტფლეისის ნივთები აქ გამოჩნდება.', 'View details': 'დეტალების ნახვა', 'No listings yet.': 'განცხადებები ჯერ არ არის.',
    'Create listing': 'განცხადების შექმნა', Cancel: 'გაუქმება', Save: 'შენახვა', 'Save Details': 'დეტალების შენახვა', 'Publish Listing': 'განცხადების გამოქვეყნება',
    'Company': 'კომპანია', Legal: 'სამართლებრივი', Community: 'საზოგადოება', 'Contact Information': 'საკონტაქტო ინფორმაცია',
    'Terms of Service': 'მომსახურების პირობები', 'Privacy Policy': 'კონფიდენციალურობის პოლიტიკა', 'Delivery Policy': 'მიწოდების პოლიტიკა',
    'Refund & Cancellation Policy': 'დაბრუნებისა და გაუქმების პოლიტიკა', 'Community Guidelines': 'საზოგადოების წესები',
    'Seller Standards & Code of Conduct': 'გამყიდველის სტანდარტები და ქცევის კოდექსი', 'Coach Standards & Code of Conduct': 'ქოუჩის სტანდარტები და ქცევის კოდექსი',
    'Secure Transactions': 'უსაფრთხო ტრანზაქციები', 'Your safety is our priority.': 'თქვენი უსაფრთხოება ჩვენი პრიორიტეტია.',
    '24/7 Support': '24/7 მხარდაჭერა', 'We are here to help anytime.': 'ყოველთვის მზად ვართ დასახმარებლად.',
    'Trusted Platform': 'სანდო პლატფორმა', 'Fair play and transparency.': 'სამართლიანი თამაში და გამჭვირვალობა.',
    'Growing Community': 'მზარდი საზოგადოება', 'Join thousands of gamers.': 'შემოუერთდით ათასობით გეიმერს.',
    'Follow us': 'გამოგვყევით', 'All rights reserved.': 'ყველა უფლება დაცულია.',
    'Play. Connect. Earn.': 'ითამაშე. დაუკავშირდი. გამოიმუშავე.',
    'WaveHubX is the ultimate gaming marketplace. Buy, sell and improve your skills with trusted coaches. Everything you need — all in one place.': 'WaveHubX არის გეიმინგ მარკეტფლეისი. იყიდეთ, გაყიდეთ და გაიუმჯობესეთ უნარები სანდო ქოუჩებთან ერთად — ყველაფერი ერთ სივრცეში.',
    'Payment & Pricing Policy': 'გადახდისა და ფასების პოლიტიკა', 'Wallet Policy': 'საფულის პოლიტიკა', 'Dispute Resolution Policy': 'დავების გადაწყვეტის პოლიტიკა',
    'Account control': 'ანგარიშის მართვა', 'Profile records': 'პროფილის ჩანაწერები', records: 'ჩანაწერი',
    'Member access': 'წევრის წვდომა', 'Make this profile yours': 'ეს პროფილი შენია', 'Sign in to manage your account, publish listings, track orders and keep everything synced across your devices.': 'შედით ანგარიშზე, მართეთ პროფილი, გამოაქვეყნეთ განცხადებები, აკონტროლეთ შეკვეთები და შეინახეთ მონაცემები სინქრონულად.',
    'Secure session': 'დაცული სესია', 'Synced activity': 'სინქრონული აქტივობა', 'Saved progress': 'შენახული პროგრესი', 'Log in': 'შესვლა', 'Continue to your account': 'ანგარიშზე გადასვლა', 'Create account': 'ანგარიშის შექმნა', 'Join WaveHub for free': 'შემოუერთდით WaveHub-ს უფასოდ',
    'User profile': 'მომხმარებლის პროფილი', 'WaveHub member': 'WaveHub-ის წევრი', 'Joined -': 'შემოუერთდა -', 'Wave rank': 'Wave რეიტინგი', 'Ranked by marketplace activity': 'რეიტინგი მარკეტფლეისის აქტივობის მიხედვით', 'No activity yet': 'აქტივობა ჯერ არ არის',
    Rating: 'შეფასება', 'Completed orders': 'დასრულებული შეკვეთები', 'Public listings': 'საჯარო განცხადებები', 'Buyer reviews': 'მყიდველის შეფასებები', 'Member since': 'წევრია',
    About: 'შესახებ', 'BIO: No bio added yet.': 'BIO: აღწერა ჯერ არ დამატებულა.', 'Member type': 'წევრის ტიპი', 'Marketplace activity': 'მარკეტფლეისის აქტივობა', 'Community member': 'საზოგადოების წევრი',
    'Main game': 'მთავარი თამაში', 'No game listed': 'თამაში არ არის მითითებული', 'Choose games in profile settings.': 'აირჩიეთ თამაშები პროფილის პარამეტრებში.', 'Secondary game': 'მეორე თამაში', 'No second game': 'მეორე თამაში არ არის', 'Choose up to two games in settings.': 'პარამეტრებში შეგიძლიათ აირჩიოთ მაქსიმუმ ორი თამაში.',
    'Achievements & badges': 'მიღწევები და ბეიჯები', 'Based on real profile activity': 'რეალურ პროფილის აქტივობაზე დაფუძნებული', 'Marketplace score': 'მარკეტფლეისის ქულა', 'Buyer rating': 'მყიდველის შეფასება', 'Verified buyer feedback': 'დადასტურებული მყიდველის შეფასებები', Reviews: 'შეფასებები', Listings: 'განცხადებები', Games: 'თამაშები', Message: 'შეტყობინება', 'WaveHub public profile': 'WaveHub-ის საჯარო პროფილი',
    'Profile photo': 'პროფილის ფოტო', 'Upload photo': 'ფოტოს ატვირთვა', 'PNG, JPG or WEBP profile image.': 'PNG, JPG ან WEBP პროფილის სურათი.', 'First name': 'სახელი', 'Last name': 'გვარი', Bio: 'ბიო', 'Main games': 'მთავარი თამაშები', 'Select up to 2': 'აირჩიეთ მაქსიმუმ 2', 'Save Changes': 'ცვლილებების შენახვა', 'View public profile': 'საჯარო პროფილის ნახვა', 'Log out': 'გასვლა',
    'Coaching Sessions': 'ქოუჩინგის სესიები', 'Add session': 'სესიის დამატება', 'No coaching sessions yet.': 'ქოუჩინგის სესიები ჯერ არ არის.', 'Checkout history': 'შეკვეთების ისტორია', 'My Purchases': 'ჩემი შესყიდვები', 'Open cart': 'კალათის გახსნა', 'No purchases yet.': 'შესყიდვები ჯერ არ არის.',
    'Seller panel': 'გამყიდველის პანელი', 'Edit Listing': 'განცხადების რედაქტირება', 'Close listing editor': 'განცხადების რედაქტორის დახურვა', 'Listing type': 'განცხადების ტიპი', Account: 'ანგარიში', Skin: 'სკინი', Game: 'თამაში', Title: 'სათაური', 'Account type': 'ანგარიშის ტიპი', 'Basic Account': 'საბაზისო ანგარიში', 'Full Collection Account': 'სრული კოლექციის ანგარიში', 'OG Account': 'OG ანგარიში', 'Premium Account': 'პრემიუმ ანგარიში', 'Ranked Account': 'რეიტინგული ანგარიში', 'Rare Account': 'იშვიათი ანგარიში', 'Account level': 'ანგარიშის დონე', 'Price (GEL)': 'ფასი (GEL)', 'Product images': 'პროდუქტის სურათები', 'Replace files': 'ფაილების ჩანაცვლება', 'Leave empty to keep current images.': 'დატოვეთ ცარიელი, თუ არსებული სურათების შენარჩუნება გსურთ.', Description: 'აღწერა', 'Save Listing': 'განცხადების შენახვა',
    'Manage Session': 'სესიის მართვა', 'Close session editor': 'სესიის რედაქტორის დახურვა', 'Coach name': 'ქოუჩის სახელი', Language: 'ენა', 'Choose language': 'აირჩიეთ ენა', English: 'ინგლისური', 'Highest rank': 'უმაღლესი რანგი', Specialty: 'სპეციალიზაცია', 'Years of experience': 'გამოცდილების წლები', 'Success rate (%)': 'წარმატების მაჩვენებელი (%)', 'Average response time (minutes)': 'საშუალო პასუხის დრო (წუთი)', 'Specific date': 'კონკრეტული თარიღი', Hour: 'საათი', 'About you': 'შენს შესახებ', 'About session': 'სესიის შესახებ', 'Coaching style': 'ქოუჩინგის სტილი', 'Expertise graph': 'უნარების გრაფიკი', Achievements: 'მიღწევები', '(optional)': '(არასავალდებულო)', 'Save Session': 'სესიის შენახვა',
    'This text will also automatically fill the “Meet Your Coach” section.': 'ეს ტექსტი ავტომატურად შეავსებს „Meet Your Coach“ სექციასაც.', 'Write one coaching style per line.': 'თითო ხაზზე ჩაწერეთ ერთი ქოუჩინგის სტილი.', 'Write one skill and its real percentage per line, using the format “Skill: 90”.': 'თითო ხაზზე ჩაწერეთ ერთი უნარი და მისი რეალური პროცენტი ფორმატით „უნარი: 90“.',
    Checkout: 'გადახდა', 'Your cart': 'შენი კალათა', 'Review your picks and complete your order securely.': 'გადახედე არჩეულ ნივთებს და უსაფრთხოდ დაასრულე შეკვეთა.', 'Cart products': 'კალათის პროდუქტები', products: 'პროდუქტი', 'Checkout progress': 'გადახდის ეტაპები', Payment: 'გადახდა', Complete: 'დასრულება', 'Order items': 'შეკვეთის ნივთები', 'Digital products in your cart': 'ციფრული პროდუქტები შენს კალათაში', 'Continue shopping': 'შოპინგის გაგრძელება', 'Cart is empty.': 'კალათა ცარიელია.', 'Checkout summary': 'შეკვეთის შეჯამება', 'Order overview': 'შეკვეთის მიმოხილვა', Summary: 'შეჯამება', Subtotal: 'შუალედური ჯამი', Items: 'ნივთები', 'Service fee': 'მომსახურების საკომისიო', Free: 'უფასო', Total: 'სულ', 'Proceed to checkout': 'გადახდაზე გადასვლა', 'Secure checkout': 'დაცული გადახდა', 'Your payment details are protected.': 'შენი გადახდის დეტალები დაცულია.', 'Search cart': 'კალათაში ძიება', 'Search cart products...': 'მოძებნე კალათის პროდუქტები...', View: 'ნახვა', Delete: 'წაშლა', 'No cart products match your search.': 'ძიებას შესაბამისი კალათის პროდუქტი არ მოიძებნა.', 'Please log in before checkout.': 'გადახდამდე გაიარე ავტორიზაცია.', 'Checkout request is ready. Sellers will confirm the order details.': 'შეკვეთის მოთხოვნა მზადაა. გამყიდველები დაადასტურებენ შეკვეთის დეტალებს.',
    'Open menu': 'მენიუს გახსნა', 'Account details': 'ანგარიშის დეტალები', Name: 'სახელი', 'Account ID': 'ანგარიშის ID', 'Logged in': 'შესულია', 'Signed in': 'შესულია', online: 'ონლაინ',
    'Marketplace filters': 'მარკეტფლეისის ფილტრები', Product: 'პროდუქტი', 'All products': 'ყველა პროდუქტი', Accounts: 'ანგარიშები', Skins: 'სკინები', 'All games': 'ყველა თამაში', Newest: 'უახლესი', Oldest: 'უძველესი', 'Price: low to high': 'ფასი: დაბლიდან მაღლისკენ', 'Price: high to low': 'ფასი: მაღლიდან დაბლისკენ', 'Live listings': 'აქტიური განცხადებები', 'Accounts & Skins': 'ანგარიშები და სკინები', 'Visible listings': 'ხილული განცხადებები',
    'Keys available': 'გასაღებები ხელმისაწვდომია', 'Steam Games': 'Steam თამაშები', Categories: 'კატეგორიები', 'New Releases': 'ახალი გამოშვებები', 'Top Sellers': 'ყველაზე გაყიდვადი', 'Gift Cards': 'სასაჩუქრე ბარათები', 'Discover games. Get your key. Start playing.': 'აღმოაჩინე თამაშები. მიიღე გასაღები. დაიწყე თამაში.', 'View All Games': 'ყველა თამაშის ნახვა', 'Steam game filters': 'Steam თამაშების ფილტრები', 'Search games': 'თამაშების ძიება', 'Search games...': 'მოძებნე თამაშები...', 'Sort by': 'დალაგება', Popular: 'პოპულარული', 'Price: Low to High': 'ფასი: დაბლიდან მაღლისკენ', 'Price: High to Low': 'ფასი: მაღლიდან დაბლისკენ', All: 'ყველა', Action: 'ექშენი', Adventure: 'სათავგადასავლო', Shooter: 'შუთერი', Strategy: 'სტრატეგია', Sports: 'სპორტი', 'Instant activation': 'მყისიერი აქტივაცია', 'gift balance': 'სასაჩუქრე ბალანსი', 'month membership': 'თვის წევრობა', 'Play more. Pay less.': 'ითამაშე მეტი. გადაიხადე ნაკლები.',
    'Browse Coaches': 'ქოუჩების ნახვა', 'Coach Panel': 'ქოუჩის პანელი', FILTERS: 'ფილტრები', Reset: 'გასუფთავება', 'Show More': 'მეტის ნახვა', 'Game Analysis': 'თამაშის ანალიზი', 'Price Range': 'ფასის დიაპაზონი', Rank: 'რანგი', 'Any Rank': 'ნებისმიერი რანგი', 'Ace or higher': 'Ace ან უფრო მაღალი', 'Immortal or higher': 'Immortal ან უფრო მაღალი', 'Diamond or higher': 'Diamond ან უფრო მაღალი', 'Master or higher': 'Master ან უფრო მაღალი', Availability: 'ხელმისაწვდომობა', 'Any Time': 'ნებისმიერ დროს', 'Available Now': 'ახლა ხელმისაწვდომია', Today: 'დღეს', Weekend: 'შაბათ-კვირა', 'Any Language': 'ნებისმიერი ენა', Georgian: 'ქართული', Russian: 'რუსული', 'Find the perfect coach to level up your game': 'იპოვე შესაფერისი ქოუჩი თამაშის დონის ასამაღლებლად', 'Sort coaches': 'ქოუჩების დალაგება', 'Sort by: Rating (High to Low)': 'შეფასებით: მაღლიდან დაბლისკენ', 'Sort by: Price (Low to High)': 'ფასით: დაბლიდან მაღლისკენ', 'Sort by: Price (High to Low)': 'ფასით: მაღლიდან დაბლისკენ', 'Sort by: Reviews': 'შეფასებებით', 'All Games': 'ყველა თამაში', More: 'მეტი', 'Coaches found': 'ნაპოვნია ქოუჩი', 'No coaches found.': 'ქოუჩი ვერ მოიძებნა.',
    'Tournaments live': 'ტურნირები აქტიურია', 'WaveHubX Championships': 'WaveHubX ჩემპიონატები', 'My Profile': 'ჩემი პროფილი', 'My Tournaments': 'ჩემი ტურნირები', "View all tournaments you've participated in.": 'ნახე ყველა ტურნირი, რომელშიც მონაწილეობდი.', 'Create Tournament': 'ტურნირის შექმნა', 'Search tournaments': 'ტურნირების ძიება', 'Search tournaments...': 'მოძებნე ტურნირები...', 'Filter by game': 'თამაშით გაფილტვრა', 'Filter by status': 'სტატუსით გაფილტვრა', Status: 'სტატუსი', Active: 'აქტიური', Completed: 'დასრულებული', 'Sort tournaments': 'ტურნირების დალაგება', 'Sort by: Latest': 'დალაგება: უახლესი', 'Sort by: Oldest': 'დალაგება: უძველესი', 'Sort by: Prize': 'დალაგება: პრიზი', 'All Tournaments': 'ყველა ტურნირი', 'Admin panel': 'ადმინის პანელი', 'No tournaments yet': 'ტურნირი ჯერ არ არის', 'Secure & Fair Play': 'უსაფრთხო და სამართლიანი თამაში', 'Big Prizes': 'დიდი პრიზები', 'For Everyone': 'ყველასთვის', 'How Tournaments Work': 'როგორ მუშაობს ტურნირები',
    'WaveHubX ecosystem': 'WaveHubX ეკოსისტემა', 'Everything you need.': 'ყველაფერი, რაც გჭირდება.', 'One Gaming Ecosystem.': 'ერთი გეიმინგ ეკოსისტემა.', 'Buy, sell, learn, compete and grow — all in one secure platform built for gamers, by gamers.': 'იყიდე, გაყიდე, ისწავლე, შეეჯიბრე და გაიზარდე — ყველაფერი ერთ დაცულ პლატფორმაზე, გეიმერების მიერ გეიმერებისთვის.', 'Protected Payments': 'დაცული გადახდები', 'Verified Sellers & Coaches': 'ვერიფიცირებული გამყიდველები და ქოუჩები', 'Gaming & Digital Services': 'გეიმინგ და ციფრული სერვისები', 'Fast Support': 'სწრაფი საფორთი', 'Explore WaveHubX': 'აღმოაჩინე WaveHubX',
    'Orders synced': 'შეკვეთები სინქრონიზებულია', 'Order history': 'შეკვეთების ისტორია', 'My Orders': 'ჩემი შეკვეთები', 'Track everything you purchased and sold on WaveHub.': 'აკონტროლე ყველაფერი, რაც WaveHub-ზე იყიდე ან გაყიდე.', orders: 'შეკვეთა', 'Sign in to view orders': 'შედით შეკვეთების სანახავად', 'Your purchase and sales history is available after login.': 'შესვლის შემდეგ ხელმისაწვდომი იქნება ყიდვებისა და გაყიდვების ისტორია.', Purchased: 'შეძენილი', Sold: 'გაყიდული', 'No orders found': 'შეკვეთები ვერ მოიძებნა', 'Your matching orders will appear here.': 'შესაბამისი შეკვეთები აქ გამოჩნდება.', 'My Listings': 'ჩემი განცხადებები', 'Add listing': 'განცხადების დამატება',
    'Your conversations': 'შენი საუბრები', 'Chat with users and reply to messages.': 'ესაუბრე მომხმარებლებს და უპასუხე შეტყობინებებს.', messages: 'შეტყობინება', Inbox: 'შემომავალი', Conversations: 'საუბრები', 'Select a conversation': 'აირჩიე საუბარი', 'Choose a user to start messaging': 'აირჩიე მომხმარებელი მიმოწერის დასაწყებად', Send: 'გაგზავნა',
    'My Wallet': 'ჩემი საფულე', 'Manage your balance, transactions and WaveCoin top ups.': 'მართე ბალანსი, ტრანზაქციები და WaveCoin-ის შევსებები.', 'Total Balance': 'საერთო ბალანსი', 'Available Balance': 'ხელმისაწვდომი ბალანსი', 'In Escrow': 'ესქროში', 'Pending Payouts': 'მოსალოდნელი გაცემები', 'Total Purchased': 'სულ შეძენილი', 'Ready to spend': 'მზადაა დასახარჯად', 'Protected payments': 'დაცული გადახდები', 'Awaiting completion': 'დასრულების მოლოდინში', 'Current wallet value': 'საფულის მიმდინარე ღირებულება', 'Add Funds': 'ბალანსის შევსება', 'Top up with BOG': 'შეავსე BOG-ით', 'WaveCoin amount': 'WaveCoin-ის ოდენობა', 'Pay with Bank of Georgia': 'გადახდა Bank of Georgia-ით', 'Transaction History': 'ტრანზაქციების ისტორია', records: 'ჩანაწერი', 'Recent activity': 'ბოლო აქტივობა', Filters: 'ფილტრები', 'Transaction categories': 'ტრანზაქციის კატეგორიები', Income: 'შემოსავალი', Expense: 'ხარჯი', Withdrawals: 'გატანები', Refunds: 'თანხის დაბრუნება', 'Type / Description': 'ტიპი / აღწერა', 'Order / ID': 'შეკვეთა / ID', 'Date & Time': 'თარიღი და დრო', Amount: 'თანხა', 'No transactions yet.': 'ტრანზაქციები ჯერ არ არის.',
    '1-on-1 Coaching': 'ინდივიდუალური ქოუჩინგი', 'Personalized guidance': 'პერსონალიზებული გზამკვლევი', 'Pro Strategies': 'პროფესიონალური სტრატეგიები', 'Learn from the best': 'ისწავლე საუკეთესოებისგან', 'Track Progress': 'პროგრესის კონტროლი', 'See real improvement': 'იხილე რეალური გაუმჯობესება', 'All Skill Levels': 'ყველა დონისთვის', 'Beginners to Pros': 'დამწყებიდან პროფესიონალამდე', 'Exciting Matches': 'დაძაბული მატჩები', 'High level competition': 'მაღალი დონის შეჯიბრება', 'Grow Your Team': 'განავითარე შენი გუნდი', 'Show your skill': 'აჩვენე შენი უნარი', 'Win Rewards': 'მოიგე ჯილდოები', 'Cash & exclusive prizes': 'ფულადი და ექსკლუზიური პრიზები', 'Join Community': 'შემოუერთდი საზოგადოებას', 'Play. Compete. Belong.': 'ითამაშე. შეეჯიბრე. იყავი ნაწილი.',
    'Search for games, services or players...': 'მოძებნე თამაშები, სერვისები ან მოთამაშეები...',
    'Search marketplace': 'მარკეტფლეისში ძიება', 'Search accounts, skins or games...': 'მოძებნე ანგარიშები, სკინები ან თამაშები...', 'Account and skin marketplace': 'ანგარიშებისა და სკინების მარკეტფლეისი', 'Your personal collection': 'შენი პირადი კოლექცია', 'saved items': 'შენახული ნივთები', 'Saved for later': 'მოგვიანებით შენახული', 'Your Collection': 'შენი კოლექცია', 'Your collection is empty': 'შენი კოლექცია ცარიელია', 'Save accounts and skins you like, then find them here anytime.': 'შეინახე სასურველი ანგარიშები და სკინები, შემდეგ კი ნებისმიერ დროს აქ იპოვი.', 'Explore Marketplace': 'მარკეტფლეისის ნახვა', 'Select game': 'აირჩიე თამაში', 'View Details': 'დეტალების ნახვა', Instant: 'მყისიერი',
    'Back to WaveHub': 'WaveHub-ზე დაბრუნება', 'WaveHub account': 'WaveHub ანგარიში', 'Log in or create account': 'შედით ან შექმენით ანგარიში', Authentication: 'ავტორიზაცია', Password: 'პაროლი', 'Confirm password': 'პაროლის დადასტურება', 'At least 6 characters': 'მინიმუმ 6 სიმბოლო', 'Repeat password': 'გაიმეორეთ პაროლი', 'Back to marketplace': 'მარკეტფლეისზე დაბრუნება',
    Updates: 'განახლებები', 'Close notifications': 'შეტყობინებების დახურვა', 'Open messages': 'შეტყობინებების გახსნა', 'No notifications yet.': 'შეტყობინებები ჯერ არ არის.', 'Log in to see notifications.': 'შედით შეტყობინებების სანახავად.', 'New message from': 'ახალი შეტყობინება მომხმარებლისგან', 'Open the conversation to reply.': 'გახსენით საუბარი პასუხის გასაცემად.', 'Order update': 'შეკვეთის განახლება', 'New order received': 'მიღებულია ახალი შეკვეთა', 'Checkout request': 'გადახდის მოთხოვნა', 'A buyer placed an order.': 'მყიდველმა შეკვეთა გააკეთა.', 'item(s)': 'ნივთი',
    'Please fill every field.': 'შეავსეთ ყველა ველი.', 'Username can use lowercase letters, numbers, _ and - only.': 'მომხმარებლის სახელი შეიძლება შეიცავდეს მხოლოდ პატარა ასოებს, ციფრებს, _ და - სიმბოლოებს.', 'Password must be at least 6 characters.': 'პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს.', 'Passwords do not match.': 'პაროლები არ ემთხვევა.', 'Registration server is unavailable. Please try again later.': 'რეგისტრაციის სერვერი მიუწვდომელია. სცადეთ მოგვიანებით.', 'Registration failed.': 'რეგისტრაცია ვერ შესრულდა.', 'Account created. Redirecting...': 'ანგარიში შეიქმნა. გადამისამართება...', 'Please enter username and password.': 'შეიყვანეთ მომხმარებლის სახელი და პაროლი.', 'Logged in. Redirecting...': 'შესვლა შესრულდა. გადამისამართება...', 'Login server is unavailable. Please try again later.': 'შესვლის სერვერი მიუწვდომელია. სცადეთ მოგვიანებით.', 'Username or password is incorrect.': 'მომხმარებლის სახელი ან პაროლი არასწორია.', 'Server error.': 'სერვერის შეცდომა.',
    'ამ ეტაპზე Featured Item-ები არ არის.': 'ამ ეტაპზე რჩეული ნივთები არ არის.',
    'Frequently': 'ხშირად დასმული', 'Asked Questions': 'კითხვები', 'Find answers to the most common questions.': 'იპოვეთ პასუხები ყველაზე ხშირად დასმულ კითხვებზე.',
    'What is WaveHubX?': 'რა არის WaveHubX?', 'Learn what WaveHubX is and how it connects gamers worldwide.': 'გაიგეთ რა არის WaveHubX და როგორ აერთიანებს ის გეიმერებს მთელ მსოფლიოში.',
    'WaveHubX is an all-in-one gaming ecosystem where players can discover marketplace products, coaches, digital services and tournaments in one secure platform.': 'WaveHubX არის ერთიანი გეიმინგ ეკოსისტემა, სადაც მოთამაშეები ერთ უსაფრთხო პლატფორმაზე პოულობენ მარკეტის პროდუქტებს, ქოუჩებს, ციფრულ სერვისებსა და ტურნირებს.',
    'How do I become a seller or coach?': 'როგორ გავხდე გამყიდველი ან ქოუჩი?', 'Start earning by offering your skills or items on WaveHubX.': 'დაიწყეთ შემოსავლის მიღება WaveHubX-ზე თქვენი უნარების ან ნივთების შეთავაზებით.',
    'Create an account, complete your profile and use the seller or coach registration tools. Once the required information is verified, you can publish your offers.': 'შექმენით ანგარიში, შეავსეთ პროფილი და გამოიყენეთ გამყიდველის ან ქოუჩის რეგისტრაციის ხელსაწყოები. საჭირო ინფორმაციის გადამოწმების შემდეგ შეძლებთ შეთავაზებების გამოქვეყნებას.',
    'How does the escrow system work?': 'როგორ მუშაობს ესქროს სისტემა?', 'We hold the payment securely until both sides are satisfied.': 'გადახდას უსაფრთხოდ ვინახავთ, სანამ ორივე მხარე კმაყოფილი არ იქნება.',
    "The buyer's payment is held securely while the order is active. Funds are released to the seller after the agreed product or service has been delivered and completed.": 'მყიდველის გადახდა უსაფრთხოდ ინახება, სანამ შეკვეთა აქტიურია. თანხა გამყიდველს ერიცხება შეთანხმებული პროდუქტის ან სერვისის მიწოდებისა და დასრულების შემდეგ.',
    'How long does delivery usually take?': 'ჩვეულებრივ რამდენ ხანს გრძელდება მიწოდება?', 'Delivery time depends on the type of service or product you choose.': 'მიწოდების დრო დამოკიდებულია თქვენს მიერ არჩეული სერვისის ან პროდუქტის ტიპზე.',
    'Each offer shows its expected delivery time. Instant products may arrive within minutes, while coaching sessions and custom services depend on scheduling.': 'თითოეულ შეთავაზებაზე მითითებულია მოსალოდნელი მიწოდების დრო. მყისიერი პროდუქტები შეიძლება რამდენიმე წუთში მიიღოთ, ხოლო ქოუჩინგის სესიები და ინდივიდუალური სერვისები განრიგზეა დამოკიდებული.',
    'Is my payment protected?': 'დაცულია ჩემი გადახდა?', 'Yes. Your payment is safe with our escrow system until the order is completed.': 'დიახ. თქვენი გადახდა დაცულია ჩვენი ესქროს სისტემით შეკვეთის დასრულებამდე.',
    'Yes. Payment remains protected during the transaction and is not released before the order reaches the required completion stage.': 'დიახ. გადახდა დაცულია ტრანზაქციის განმავლობაში და არ გათავისუფლდება, სანამ შეკვეთა საჭირო დასრულების ეტაპს არ მიაღწევს.',
    'Can I request a refund?': 'შემიძლია თანხის დაბრუნების მოთხოვნა?', "Yes, you can request a refund if the terms are not met. We've got you covered.": 'დიახ, პირობების შეუსრულებლობის შემთხვევაში შეგიძლიათ თანხის დაბრუნება მოითხოვოთ.',
    "If an order does not meet the agreed terms, contact support with the order details. The case will be reviewed according to the platform's refund rules.": 'თუ შეკვეთა შეთანხმებულ პირობებს არ აკმაყოფილებს, შეკვეთის დეტალებით დაუკავშირდით მხარდაჭერას. საქმე განიხილება პლატფორმის თანხის დაბრუნების წესების შესაბამისად.',
    'Still have questions?': 'კითხვები კვლავ გაქვთ?', 'Our support team is ready to help you.': 'ჩვენი მხარდაჭერის გუნდი მზად არის დაგეხმაროთ.', 'Contact Support': 'დაუკავშირდი საფორთს',
    'Train with the best. Compete for glory.': 'ივარჯიშეთ საუკეთესოთა გვერდით. იბრძოლეთ გამარჯვებისთვის.', 'Top Coaches': 'საუკეთესო ქოუჩები',
    '1-on-1 sessions. Real results.': 'ინდივიდუალური სესიები. რეალური შედეგები.', 'View All': 'ყველას ნახვა', 'Most booked': 'ყველაზე მოთხოვნადი',
    'Pro coach': 'პროფესიონალი ქოუჩი', 'Top rated': 'უმაღლესი შეფასება', Online: 'ონლაინ', 'Book Session': 'სესიის დაჯავშნა',
    'Explore All Coaches': 'ყველა ქოუჩის ნახვა', '1-on-1 Coaching': 'ინდივიდუალური ქოუჩინგი', 'Personalized guidance': 'პერსონალიზებული მხარდაჭერა',
    'Pro Strategies': 'პროფესიონალური სტრატეგიები', 'Learn from the best': 'ისწავლეთ საუკეთესოებისგან', 'Track Progress': 'პროგრესის მონიტორინგი',
    'See real improvement': 'იხილეთ რეალური გაუმჯობესება', 'All Skill Levels': 'ნებისმიერი უნარის დონე', 'Beginners to Pros': 'დამწყებიდან პროფესიონალამდე',
    'Featured Tournament': 'რჩეული ტურნირი', 'Compete. Win. Make your mark.': 'ითამაშე. გაიმარჯვე. დატოვე კვალი.',
    'Registration Open': 'რეგისტრაცია ღიაა', 'Single Elimination': 'ერთჯერადი გამოთიშვა', 'Prize Pool': 'საპრიზო ფონდი', 'Entry Fee': 'შესვლის საფასური', Teams: 'გუნდები',
    'Explore': 'აღმოაჩინე', 'Compare & Choose': 'შეადარე და აირჩიე', 'Order Securely': 'შეუკვეთე უსაფრთხოდ', 'Receive & Confirm': 'მიიღე და დაადასტურე',
    'Browse thousands of listings': 'დაათვალიერეთ ათასობით განცხადება', 'Discover new deals daily': 'აღმოაჩინეთ ახალი შეთავაზებები ყოველდღე',
    'Search accounts, skins or games...': 'მოძებნეთ ანგარიშები, სკინები ან თამაშები...', 'No results found.': 'შედეგები ვერ მოიძებნა.',
    'Add to Cart': 'კალათაში დამატება', 'Buy Now': 'ახლავე ყიდვა', 'Continue Shopping': 'ყიდვის გაგრძელება', 'Checkout': 'გადახდაზე გადასვლა',
    'Back': 'უკან', 'Close': 'დახურვა', 'Edit': 'რედაქტირება', 'Delete': 'წაშლა', 'Confirm': 'დადასტურება', 'Loading...': 'იტვირთება...',
    'Back to Steam Games': 'Steam თამაშებზე დაბრუნება', 'Steam Key': 'Steam გასაღები', 'In Stock': 'მარაგშია', 'Instant Delivery': 'მყისიერი მიწოდება',
    'Verified game key': 'დამოწმებული თამაშის გასაღები', Platform: 'პლატფორმა', Delivery: 'მიწოდება', Region: 'რეგიონი', Stock: 'მარაგი', Edition: 'გამოცემა', Language: 'ენა',
    Global: 'გლობალური', 'Standard Edition': 'სტანდარტული გამოცემა', 'Multi-Language': 'მრავალენოვანი', 'Add to Wishlist': 'რჩეულებში დამატება', Share: 'გაზიარება',
    Overview: 'მიმოხილვა', 'Activation Guide': 'აქტივაციის ინსტრუქცია', 'System Requirements': 'სისტემური მოთხოვნები', Reviews: 'შეფასებები',
    'About the Game': 'თამაშის შესახებ', 'What You Receive': 'რას მიიღებთ', 'How Activation Works': 'როგორ მუშაობს აქტივაცია', 'Important Information': 'მნიშვნელოვანი ინფორმაცია',
    'Steam activation key': 'Steam-ის აქტივაციის გასაღები', 'Instant delivery via WaveHubX': 'მყისიერი მიწოდება WaveHubX-ით', 'Complete payment': 'დაასრულეთ გადახდა',
    'Receive your Steam key instantly': 'მიიღეთ Steam-ის გასაღები მყისიერად', 'Activate on Steam and enjoy': 'გააქტიურეთ Steam-ზე და ისიამოვნეთ',
    'This is a global Steam key unless stated otherwise.': 'ეს არის გლობალური Steam გასაღები, თუ სხვა რამ არ არის მითითებული.',
    'No refunds after a key is revealed or activated.': 'გასაღების გამჟღავნების ან აქტივაციის შემდეგ თანხა არ ბრუნდება.',
    'Delivery is managed from your WaveHubX order page.': 'მიწოდება იმართება თქვენი WaveHubX შეკვეთების გვერდიდან.'
  };
  const originalText = new WeakMap();
  const translatableAttributes = ['aria-label', 'title', 'placeholder'];
  const originalDocumentTitle = document.title;
  const titleTranslations = {
    'WaveHub - Profile': 'WaveHub - პროფილი', 'WaveHub - Cart': 'WaveHub - კალათა', 'WaveHub - Coaching': 'WaveHub - ქოუჩინგი', 'WaveHubX - Tournaments': 'WaveHubX - ტურნირები',
    'WaveHubX - About Us': 'WaveHubX - ჩვენს შესახებ', 'WaveHub - Orders': 'WaveHub - შეკვეთები', 'WaveHub - Messages': 'WaveHub - შეტყობინებები', 'WaveHub - Wallet': 'WaveHub - საფულე',
    'WaveHubX - Steam Keys': 'WaveHubX - Steam გასაღებები', 'WaveHub - Marketplace': 'WaveHub - მარკეტფლეისი', 'WaveHub - Main': 'WaveHub - მთავარი',
    'WaveHub - Account': 'WaveHub - ანგარიში', 'WaveHub - Coach Profile': 'WaveHub - ქოუჩის პროფილი', 'WaveHub - Detail': 'WaveHub - დეტალები', 'Steam Game - WaveHubX': 'Steam თამაში - WaveHubX', 'WaveHubX Tournament': 'WaveHubX ტურნირი'
  };
  let aboutUsOriginalMarkup;
  const policyOriginalMarkup = new Map();

  const localizeAboutUs = language => {
    const aboutPage = document.querySelector('.policy-page[aria-labelledby="aboutUsTitle"]');
    if (!aboutPage) return;
    if (aboutUsOriginalMarkup === undefined) aboutUsOriginalMarkup = aboutPage.innerHTML;
    if (language !== 'en') {
      aboutPage.innerHTML = aboutUsOriginalMarkup;
      return;
    }
    aboutPage.innerHTML = `
      <header class="policy-hero"><p><span></span><b>About WaveHubX</b><span></span></p><h1 id="aboutUsTitle">WaveHubX — About Us</h1><p>WaveHubX is Georgia’s first digital gaming platform, bringing together gaming services, digital products and the tools players need in one place.</p><p>Our goal is to build a secure, transparent and user-focused platform where gamers can easily find and purchase the gaming services and digital products they need.</p></header>
      <div class="policy-content">
        <section><h2><span>1</span> Platform Areas</h2><p>WaveHubX gives users access to a growing range of gaming experiences and services, including:</p><ul><li>Gaming coaching;</li><li>Digital products and services;</li><li>Marketplace listings;</li><li>Steam Games;</li><li>Tournaments and other gaming activities.</li></ul></section>
        <section><h2><span>2</span> Secure Orders</h2><p>A safe and transparent ordering process is one of the platform’s core principles.</p><p>Payments for orders made through WaveHubX are completed only through official platform payment channels. Sellers and service providers may not offer users direct payments outside the platform.</p></section>
        <section><h2><span>3</span> User Protection</h2><p>WaveHubX places special emphasis on protecting user rights, service quality, data privacy and fraud prevention.</p><p>The platform is governed by rules for users, sellers and coaches, as well as policies for refunds, cancellations, dispute resolution and privacy.</p></section>
        <section><h2><span>4</span> Growth and Mission</h2><p>WaveHubX develops continuously, adding new features and services as the platform grows.</p><p>Our mission is to build a trusted and modern gaming ecosystem in Georgia that gives users access to diverse gaming services in one organized space.</p></section>
      </div>
      <footer class="policy-document-footer">© 2026 WaveHubX. All rights reserved.</footer>`;
  };

  const policyDocuments = {
    'terms-of-service.html': ['Terms of Service', 'Terms of Service', 'These Terms govern use of the WaveHubX platform, including accounts, the marketplace, coaching, wallet services and related features.', [['Accounts', 'You are responsible for accurate account details, keeping login credentials confidential and activity performed through your account.'], ['Platform Use', 'Use WaveHubX lawfully and in accordance with these Terms. Fraud, misleading information, unauthorized access and misuse of the platform are prohibited.'], ['Marketplace and Coaching', 'Sellers and coaches are responsible for the accuracy of their offers, timely delivery and compliance with the stated conditions.'], ['Payments', 'Payments must be made through official WaveHubX payment channels. Direct off-platform payment arrangements are prohibited.'], ['Wallet and Payouts', 'Wallet balances and payouts are handled under the applicable wallet and payout rules.'], ['Contact', 'For questions about these Terms, contact WaveHubX support at wavehubx@gmail.com.']]],
    'privacy-policy.html': ['Privacy Policy', 'Privacy Policy', 'This policy explains how WaveHubX collects, uses, stores and protects personal information.', [['Information We Collect', 'We may collect account details, contact information, transaction details, device data and communications needed to operate and secure the platform.'], ['How We Use Information', 'Information is used to provide services, process transactions, prevent fraud, improve the platform and meet legal obligations.'], ['Sharing and Security', 'We do not sell personal data. Information is shared only with trusted service providers or authorities where necessary and lawful.'], ['Your Rights', 'You may request access, correction, deletion or restriction of your personal information where applicable.'], ['Data Retention', 'Information is retained only for as long as needed for service delivery, security, dispute resolution and legal compliance.'], ['Contact', 'For privacy requests, contact wavehubx@gmail.com.']]],
    'refund-cancellation.html': ['Refund & Cancellation Policy', 'Refund & Cancellation Policy', 'This policy explains when an order can be cancelled or refunded on WaveHubX.', [['Cancellation Requests', 'A buyer may request cancellation before delivery where the order has not been completed and the request meets platform rules.'], ['Refund Eligibility', 'Refunds may be considered when an order materially fails to meet the agreed terms, delivery is not completed or a verified issue is found.'], ['Non-refundable Cases', 'Refunds are generally unavailable after a digital key has been revealed or activated, or after a completed service has been confirmed without a valid dispute.'], ['Review Process', 'Support reviews relevant order information, messages and evidence before making a decision.'], ['Contact', 'Submit refund or cancellation questions to WaveHubX support with your order details.']]],
    'delivery-policy.html': ['Delivery Policy', 'Delivery Policy', 'This policy describes delivery expectations for digital products, marketplace items and coaching services.', [['Delivery Times', 'Each offer displays an expected delivery time. Instant products may be delivered within minutes; other services depend on the seller or coach schedule.'], ['Buyer Responsibilities', 'Buyers must provide correct information, remain reachable through WaveHubX and follow required delivery instructions.'], ['Seller and Coach Responsibilities', 'Sellers and coaches must deliver as described, within the stated timeframe, and communicate promptly about any delay.'], ['Delivery Confirmation', 'Orders are considered complete after the agreed item or service is delivered and the relevant completion process is finished.'], ['Issues', 'If delivery does not meet the agreed terms, contact support with the order details and supporting evidence.']]],
    'dispute-resolution.html': ['Dispute Resolution Policy', 'Dispute Resolution Policy', 'WaveHubX provides a structured process for resolving order-related disputes fairly and transparently.', [['Opening a Dispute', 'A buyer, seller or coach may contact support when an order does not meet agreed terms.'], ['Evidence', 'The parties may be asked to provide order history, chat messages, screenshots, delivery records or other relevant evidence.'], ['Review', 'WaveHubX reviews the available evidence and may request additional information before issuing a decision.'], ['Outcome', 'Depending on the case, funds may be released, refunded, partially refunded or held until the matter is resolved.'], ['Cooperation', 'All parties must communicate respectfully and provide accurate information during the review.']]],
    'community-guidelines.html': ['Community Guidelines', 'Community Guidelines', 'WaveHubX is a professional gaming community built on safety, respect and fair play.', [['Respect', 'Treat other users with courtesy. Harassment, threats, discrimination, bullying and hateful conduct are prohibited.'], ['Safe Community', 'Fraud, impersonation, misleading information and attempts to compromise account or platform security are prohibited.'], ['Account Security', 'Keep passwords, verification codes and account access details private.'], ['Communication', 'Do not spam, threaten, insult or use messages to mislead other users.'], ['Reviews and Content', 'Reviews and published content must be genuine, fair and based on real experience.'], ['Enforcement', 'Violations may result in warnings, restricted features, suspension or permanent account removal.']]],
    'seller-standards.html': ['Seller Standards & Code of Conduct', 'Seller Standards & Code of Conduct', 'These standards define the responsibilities of sellers using WaveHubX.', [['Accurate Listings', 'Publish only truthful, clear and complete listings with accurate pricing, conditions and delivery details.'], ['Delivery', 'Deliver the advertised item or service within the stated timeframe and keep buyers informed.'], ['Communication', 'Communicate professionally and only through appropriate platform channels.'], ['Prohibited Conduct', 'Fake listings, off-platform payment requests, fraud and manipulation of reviews are prohibited.'], ['Enforcement', 'Breaches may lead to listing removal, payout restrictions, suspension or account termination.']]],
    'coach-standards.html': ['Coach Standards & Code of Conduct', 'Coach Standards & Code of Conduct', 'These standards define professional expectations for coaches on WaveHubX.', [['Professional Service', 'Provide the booked session professionally, on time and in line with the advertised coaching offer.'], ['Respectful Conduct', 'Treat every player respectfully and maintain a safe, inclusive learning environment.'], ['Scheduling and Delivery', 'Communicate schedule changes promptly and complete agreed sessions or services as described.'], ['Integrity', 'Do not make misleading promises, request off-platform payments or misuse player information.'], ['Enforcement', 'Violations may result in warnings, restricted access, suspension or removal from the coaching program.']]]
  };

  const localizePolicyPage = language => {
    const file = location.pathname.split('/').pop().toLowerCase();
    const documentData = policyDocuments[file];
    if (!documentData) return;
    const policyPage = document.querySelector('.policy-page');
    if (!policyPage) return;
    if (!policyOriginalMarkup.has(file)) policyOriginalMarkup.set(file, policyPage.innerHTML);
    if (language !== 'en') { policyPage.innerHTML = policyOriginalMarkup.get(file); return; }
    const [kicker, title, intro, sections] = documentData;
    policyPage.innerHTML = `<header class="policy-hero"><p><span></span><b>${kicker}</b><span></span></p><h1 id="policyTitle">WaveHubX — ${title}</h1><p>${intro}</p></header><div class="policy-content">${sections.map(([heading, copy], index) => `<section><h2><span>${index + 1}</span> ${heading}</h2><p>${copy}</p></section>`).join('')}</div><footer class="policy-document-footer">© 2026 WaveHubX. All rights reserved.</footer>`;
  };

  const setLanguage = language => {
    const selectedLanguage = language === 'en' ? 'en' : 'ka';
    localStorage.setItem(languageKey, selectedLanguage);
    document.documentElement.lang = selectedLanguage;
    document.title = selectedLanguage === 'ka' ? titleTranslations[originalDocumentTitle] || originalDocumentTitle : originalDocumentTitle;
    document.querySelectorAll('[data-language-option]').forEach(button => {
      const active = button.dataset.languageOption === selectedLanguage;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-language-select]').forEach(select => { select.value = selectedLanguage; });
    localizeAboutUs(selectedLanguage);
    localizePolicyPage(selectedLanguage);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest('script, style, [data-i18n-keep]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!originalText.has(node)) originalText.set(node, node.nodeValue);
      const original = originalText.get(node);
      const trimmed = original.trim();
      if (!trimmed || !translations[trimmed]) { node.nodeValue = selectedLanguage === 'en' ? original : node.nodeValue; return; }
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      node.nodeValue = selectedLanguage === 'ka' ? `${leading}${translations[trimmed]}${trailing}` : original;
    });

    document.querySelectorAll('*').forEach(element => translatableAttributes.forEach(attribute => {
      const value = element.getAttribute(attribute);
      const key = `data-i18n-original-${attribute}`;
      const original = element.getAttribute(key) || value;
      if (!original || !translations[original]) return;
      if (!element.hasAttribute(key)) element.setAttribute(key, original);
      element.setAttribute(attribute, selectedLanguage === 'ka' ? translations[original] : original);
    }));
  };

  const addHeaderLanguageSwitcher = () => {
    const header = document.querySelector('.topbar, .global-topbar, .about-topbar, .faq-topbar');
    if (document.querySelector('.language-switcher')) return;
    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', 'Language selector');
    switcher.innerHTML = '<button type="button" data-language-option="en" aria-label="English"><img src="assets/united-kingdom-flag.png" alt="" aria-hidden="true"><span>EN</span></button><button type="button" data-language-option="ka" aria-label="ქართული"><img src="assets/georgian-flag-icon.png" alt="" aria-hidden="true"><span>ქა</span></button>';
    switcher.querySelectorAll('[data-language-option]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.languageOption)));
    const actions = header?.querySelector('.top-actions');
    if (header) (actions || header).prepend(switcher);
    else {
      switcher.classList.add('language-switcher-floating');
      document.body.appendChild(switcher);
    }
  };

  if (document.querySelector('.site-footer')) return;

  const icon = (path, viewBox = '0 0 24 24') => `
    <svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${path}</svg>`;

  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.setAttribute('aria-label', 'WaveHubX footer');
  footer.innerHTML = `
    <div class="site-footer-main">
      <section class="site-footer-brand" aria-labelledby="footerBrandTitle">
        <a href="index.html" class="site-footer-logo" aria-label="WaveHubX home">
          <img src="assets/logo-wavehubx-main.png" alt="WaveHubX" />
          <span id="footerBrandTitle">Play. Connect. Earn.</span>
        </a>
        <p>WaveHubX is the ultimate gaming marketplace. Buy, sell and improve your skills with trusted coaches. Everything you need — all in one place.</p>
        <ul class="site-footer-trust">
          <li>${icon('<path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z"/>')}<span><strong>Secure Transactions</strong><small>Your safety is our priority.</small></span></li>
          <li>${icon('<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H2v6h4v-6H4Zm16 0h2v6h-4v-6h2ZM18 20c0 1.2-1.4 2-3.5 2"/>')}<span><strong>24/7 Support</strong><small>We are here to help anytime.</small></span></li>
          <li>${icon('<circle cx="12" cy="10" r="6"/><path d="m8 16-1 5 5-2 5 2-1-5M9.5 10.2l1.7 1.7 3.4-3.6"/>')}<span><strong>Trusted Platform</strong><small>Fair play and transparency.</small></span></li>
          <li>${icon('<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M15 14a5 5 0 0 1 6 5v1"/>')}<span><strong>Growing Community</strong><small>Join thousands of gamers.</small></span></li>
        </ul>
      </section>

      <nav class="site-footer-column" aria-labelledby="footerCompanyTitle">
        <h2 id="footerCompanyTitle">${icon('<path d="M4 21V5h10v16M14 9h6v12M7 9h2M7 13h2M7 17h2M11 9h1M11 13h1M11 17h1M17 13h1M17 17h1M2 21h20"/>')}<span>Company</span></h2>
        <a href="about-us.html">About Us</a>
        <a href="contact-information.html">Contact Information</a>
      </nav>

      <nav class="site-footer-column site-footer-legal" aria-labelledby="footerLegalTitle">
        <h2 id="footerLegalTitle">${icon('<path d="M12 3 20 6v6c0 5-3.2 8.2-8 10-4.8-1.8-8-5-8-10V6l8-3Z"/><path d="M9 11a3 3 0 0 0 6 0V9M12 8v3"/>')}<span>Legal</span></h2>
        <a href="terms-of-service.html">Terms of Service</a>
        <a href="privacy-policy.html">Privacy Policy</a>
        <a href="refund-cancellation.html">Refund &amp; Cancellation Policy</a>
        <a href="delivery-policy.html">Delivery Policy</a>
        <a href="about.html#payments">Payment &amp; Pricing Policy</a>
        <a href="about.html#wallet">Wallet Policy</a>
        <a href="dispute-resolution.html">Dispute Resolution Policy</a>
      </nav>

      <nav class="site-footer-column" aria-labelledby="footerCommunityTitle">
        <h2 id="footerCommunityTitle">${icon('<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20v-2a6 6 0 0 1 12 0v2M14 14a5 5 0 0 1 7 4.5V20"/>')}<span>Community</span></h2>
        <a href="community-guidelines.html">Community Guidelines</a>
        <a href="seller-standards.html">Seller Standards &amp; Code of Conduct</a>
        <a href="coach-standards.html">Coach Standards &amp; Code of Conduct</a>
      </nav>
    </div>

    <div class="site-footer-bottom">
      <p>© 2026 <strong>WaveHubX.</strong> All rights reserved.</p>
      <div class="site-footer-socials" aria-label="Social media">
        <b>Follow us</b>
        <span aria-hidden="true"></span>
        <a class="facebook" href="https://www.facebook.com/profile.php?id=61592006158520" target="_blank" rel="noopener" aria-label="Facebook">${icon('<path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v5h4v-5h3l1-4h-4V9c0-.7.3-1 1-1Z"/>')}</a>
        <a class="instagram" href="https://www.instagram.com/wavehubx/" target="_blank" rel="noopener" aria-label="Instagram">${icon('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>')}</a>
        <a class="tiktok" href="https://www.tiktok.com/@wavehubx" target="_blank" rel="noopener" aria-label="TikTok">${icon('<path d="M14 4v11.2a4.2 4.2 0 1 1-3.6-4.2M14 4c.5 3 2.2 4.5 5 4.8"/>')}</a>
        <a class="discord" href="https://discord.gg/4nqVTBA4d" target="_blank" rel="noopener" aria-label="Discord">${icon('<path class="discord-mark" d="M18.8 5.7A16 16 0 0 0 15 4.5l-.5 1a13.5 13.5 0 0 0-5 0l-.5-1a16 16 0 0 0-3.8 1.2C3.6 8.1 2.8 10.8 2.6 14c1.8 2 3.6 3.1 5.4 3.8l1.3-1.7a11 11 0 0 1-2-1c3 1.4 6.4 1.4 9.4 0-.6.4-1.3.7-2 1l1.3 1.7c1.8-.7 3.6-1.8 5.4-3.8-.2-3.2-1-5.9-2.6-8.3Z"/><ellipse class="discord-eye" cx="9" cy="11.8" rx="1.25" ry="1.55"/><ellipse class="discord-eye" cx="15" cy="11.8" rx="1.25" ry="1.55"/>')}</a>
      </div>
      <label class="site-footer-language">
        ${icon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>')}
        <select data-language-select aria-label="Language"><option value="en">EN</option><option value="ka">ქა</option></select>
      </label>
    </div>`;

  document.body.appendChild(footer);
  window.wavehubTranslate = text => (localStorage.getItem(languageKey) || 'ka') === 'ka' ? translations[text] || text : text;
  footer.querySelector('[data-language-select]')?.addEventListener('change', event => setLanguage(event.target.value));
  addHeaderLanguageSwitcher();
  setLanguage(localStorage.getItem(languageKey) || 'ka');

  const translateDynamicText = node => {
    if (node.nodeType !== Node.TEXT_NODE || node.parentElement?.closest('script, style, [data-i18n-keep]')) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const original = originalText.get(node);
    const trimmed = original.trim();
    const translated = translations[trimmed];
    if (!translated) return;
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const nextValue = `${leading}${translated}${trailing}`;
    if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
  };

  new MutationObserver(records => {
    if ((localStorage.getItem(languageKey) || 'ka') !== 'ka') return;
    records.forEach(record => {
      if (record.type === 'characterData') translateDynamicText(record.target);
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) translateDynamicText(node);
        if (node.nodeType === Node.ELEMENT_NODE) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) translateDynamicText(walker.currentNode);
        }
      });
    });
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
})();
