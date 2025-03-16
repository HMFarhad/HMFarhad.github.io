// Smooth Scrolling
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Mobile Menu Toggle
const nav = document.querySelector('nav ul');
document.querySelector('.menu-toggle').addEventListener('click', () => {
    nav.classList.toggle('active');
});